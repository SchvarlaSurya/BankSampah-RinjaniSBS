-- Fungsi keuangan: satu-satunya jalur tulis ke transactions & transaction_items.
-- SECURITY DEFINER (jalan sebagai owner), search_path kosong, semua nama schema-qualified.
--
-- Kontrak error (contract/index.ts, DB_ERROR_CODES): setiap kegagalan yang diharapkan
-- memakai RAISE EXCEPTION USING MESSAGE = '<KODE>' persis, tanpa teks tambahan.
-- DETAIL hanya berisi id & angka untuk log server; tidak pernah dikirim ke klien.
--
-- Wajib READ COMMITTED: pengecekan saldo, hash foto, dan client_request_id mengandalkan
-- snapshot baru per statement setelah lock diperoleh. Di REPEATABLE READ / SERIALIZABLE
-- snapshot diambil di awal transaksi, sehingga dua tarik paralel bisa sama-sama lolos.
-- Pelanggaran ini salah konfigurasi server, bukan salah input: MESSAGE
-- 'ISOLATION_LEVEL_TIDAK_DIDUKUNG' (bukan kode kontrak, jadi menjadi SERVER_ERROR).
--
-- Advisory lock (bentuk dua-int, namespace terpisah), urutan selalu:
--   1. namespace 1: client_request_id
--   2. namespace 2: hash foto (setor) ATAU baris nasabah FOR UPDATE (tarik/koreksi)

-- Idempotency: kembalikan transaksi yang sudah dibuat dengan client_request_id ini.
-- Kosong bila belum ada. VALIDASI_GAGAL bila UUID dipakai untuk operasi lain.
-- Hash foto, item, dan jumlah sengaja TIDAK dibandingkan: retry mengembalikan transaksi asli.
CREATE FUNCTION public.cek_request_ulang(
  p_client_request_id uuid,
  p_tipe text,
  p_customer_id text,
  p_admin_id text,
  p_reverses_id bigint
)
RETURNS TABLE (transaction_id bigint, saldo_baru bigint)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_id bigint;
  v_tipe text;
  v_customer_id text;
  v_dibuat_oleh text;
  v_reverses_id bigint;
BEGIN
  SELECT t.id, t.tipe, t.customer_id, t.dibuat_oleh, t.reverses_id
    INTO v_id, v_tipe, v_customer_id, v_dibuat_oleh, v_reverses_id
  FROM public.transactions t
  WHERE t.client_request_id = p_client_request_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_tipe IS DISTINCT FROM p_tipe
     OR v_customer_id IS DISTINCT FROM p_customer_id
     OR v_dibuat_oleh IS DISTINCT FROM p_admin_id
     OR v_reverses_id IS DISTINCT FROM p_reverses_id THEN
    RAISE EXCEPTION USING
      MESSAGE = 'VALIDASI_GAGAL',
      DETAIL = pg_catalog.format('client_request_id sudah dipakai transaction_id=%s dengan parameter berbeda', v_id);
  END IF;

  transaction_id := v_id;
  SELECT COALESCE(sum(t.jumlah), 0) INTO saldo_baru
  FROM public.transactions t
  WHERE t.customer_id = v_customer_id;
  RETURN NEXT;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION public.setor(
  p_customer_id text,
  p_admin_id text,
  p_client_request_id uuid,
  p_items jsonb,
  p_path_foto text,
  p_hash_foto text,
  p_catatan text DEFAULT NULL
)
RETURNS TABLE (transaction_id bigint, saldo_baru bigint, duplikat boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_aktif boolean;
  v_item jsonb;
  v_urutan bigint;
  v_id_num numeric;
  v_waste_type_id bigint;
  v_berat numeric;
  v_harga integer;
  v_harga_aktif boolean;
  v_subtotal numeric;
  v_total numeric := 0;
  v_waste_type_ids bigint[] := '{}';
  v_berats numeric[] := '{}';
  v_hargas integer[] := '{}';
  v_subtotals integer[] := '{}';
  v_transaksi_aktif bigint;
  v_constraint text;
  v_id bigint;
  v_saldo bigint;
BEGIN
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'ISOLATION_LEVEL_TIDAK_DIDUKUNG',
      DETAIL = pg_catalog.format('transaction_isolation=%s', pg_catalog.current_setting('transaction_isolation'));
  END IF;

  -- 1. Idempotency, paling dulu.
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'VALIDASI_GAGAL', DETAIL = 'client_request_id kosong';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(1, pg_catalog.hashtext(p_client_request_id::text));

  SELECT r.transaction_id, r.saldo_baru INTO v_id, v_saldo
  FROM public.cek_request_ulang(p_client_request_id, 'setor', p_customer_id, p_admin_id, NULL) r;
  IF FOUND THEN
    transaction_id := v_id;
    saldo_baru := v_saldo;
    duplikat := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 2. Admin
  SELECT u.role, u.aktif INTO v_role, v_aktif FROM public."user" u WHERE u.id = p_admin_id;
  IF NOT FOUND OR v_role NOT IN ('admin', 'super_admin') OR NOT v_aktif THEN
    RAISE EXCEPTION USING MESSAGE = 'TIDAK_DIIZINKAN', DETAIL = pg_catalog.format('admin_id=%s', p_admin_id);
  END IF;

  -- 3. Nasabah (setor wajib nasabah aktif)
  SELECT u.role, u.aktif INTO v_role, v_aktif FROM public."user" u WHERE u.id = p_customer_id;
  IF NOT FOUND OR v_role <> 'nasabah' THEN
    RAISE EXCEPTION USING MESSAGE = 'NASABAH_TIDAK_DITEMUKAN', DETAIL = pg_catalog.format('customer_id=%s', p_customer_id);
  END IF;
  IF NOT v_aktif THEN
    RAISE EXCEPTION USING MESSAGE = 'NASABAH_NONAKTIF', DETAIL = pg_catalog.format('customer_id=%s', p_customer_id);
  END IF;

  -- 4. Foto
  IF p_path_foto IS NULL OR pg_catalog.btrim(p_path_foto) = ''
     OR p_hash_foto IS NULL OR pg_catalog.btrim(p_hash_foto) = '' THEN
    RAISE EXCEPTION USING MESSAGE = 'VALIDASI_GAGAL', DETAIL = 'path_foto/hash_foto kosong';
  END IF;

  -- 5. Item. Harga SELALU diambil dari waste_types, bukan dari client.
  IF p_items IS NULL
     OR pg_catalog.jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'VALIDASI_GAGAL', DETAIL = 'items bukan array atau kosong';
  END IF;

  FOR v_item, v_urutan IN
    SELECT e.value, e.ordinality
    FROM pg_catalog.jsonb_array_elements(p_items) WITH ORDINALITY AS e(value, ordinality)
  LOOP
    IF pg_catalog.jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(v_item -> 'waste_type_id') IS DISTINCT FROM 'number'
       OR pg_catalog.jsonb_typeof(v_item -> 'berat') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION USING MESSAGE = 'VALIDASI_GAGAL', DETAIL = pg_catalog.format('item=%s format', v_urutan);
    END IF;

    v_id_num := (v_item ->> 'waste_type_id')::numeric;
    IF v_id_num <> pg_catalog.trunc(v_id_num) OR v_id_num <= 0 OR v_id_num > 9223372036854775807 THEN
      RAISE EXCEPTION USING MESSAGE = 'VALIDASI_GAGAL', DETAIL = pg_catalog.format('item=%s waste_type_id', v_urutan);
    END IF;
    v_waste_type_id := v_id_num::bigint;

    -- Batas atas mengikuti kolom numeric(10,2); batas bisnis (LIMIT.MAKS_BERAT_KG) dicek di lapisan TS.
    v_berat := (v_item ->> 'berat')::numeric;
    IF v_berat <= 0 OR v_berat <> pg_catalog.round(v_berat, 2) OR v_berat >= 100000000 THEN
      RAISE EXCEPTION USING MESSAGE = 'VALIDASI_GAGAL', DETAIL = pg_catalog.format('item=%s berat=%s', v_urutan, v_berat);
    END IF;

    SELECT w.harga_beli, w.aktif INTO v_harga, v_harga_aktif
    FROM public.waste_types w
    WHERE w.id = v_waste_type_id;
    IF NOT FOUND OR NOT v_harga_aktif THEN
      RAISE EXCEPTION USING
        MESSAGE = 'JENIS_SAMPAH_TIDAK_VALID',
        DETAIL = pg_catalog.format('item=%s waste_type_id=%s', v_urutan, v_waste_type_id);
    END IF;

    v_subtotal := pg_catalog.round(v_berat * v_harga);
    IF v_subtotal <= 0 THEN
      RAISE EXCEPTION USING
        MESSAGE = 'ITEM_TERLALU_KECIL',
        DETAIL = pg_catalog.format('item=%s berat=%s harga=%s', v_urutan, v_berat, v_harga);
    END IF;

    v_total := v_total + v_subtotal;
    IF v_total > 2147483647 THEN
      RAISE EXCEPTION USING MESSAGE = 'VALIDASI_GAGAL', DETAIL = pg_catalog.format('total=%s melebihi batas integer', v_total);
    END IF;

    v_waste_type_ids := v_waste_type_ids || v_waste_type_id;
    v_berats := v_berats || v_berat;
    v_hargas := v_hargas || v_harga;
    v_subtotals := v_subtotals || v_subtotal::integer;
  END LOOP;

  -- 6. Hash foto hanya boleh dipakai ulang kalau setor sebelumnya sudah dibalik.
  PERFORM pg_catalog.pg_advisory_xact_lock(2, pg_catalog.hashtext(p_hash_foto));

  SELECT t.id INTO v_transaksi_aktif
  FROM public.transactions t
  WHERE t.hash_foto = p_hash_foto
    AND t.tipe = 'setor'
    AND NOT EXISTS (SELECT 1 FROM public.transactions k WHERE k.reverses_id = t.id)
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'FOTO_SUDAH_DIPAKAI',
      DETAIL = pg_catalog.format('transaction_id=%s', v_transaksi_aktif);
  END IF;

  -- 7. Tulis. unique_violation pada client_request_id = pengaman terakhir race UUID.
  BEGIN
    INSERT INTO public.transactions
      (customer_id, tipe, jumlah, dibuat_oleh, catatan, path_foto, hash_foto, client_request_id)
    VALUES
      (p_customer_id, 'setor', v_total::integer, p_admin_id, p_catatan, p_path_foto, p_hash_foto, p_client_request_id)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IS DISTINCT FROM 'transactions_client_request_id_unique' THEN
      RAISE;
    END IF;
    SELECT r.transaction_id, r.saldo_baru INTO v_id, v_saldo
    FROM public.cek_request_ulang(p_client_request_id, 'setor', p_customer_id, p_admin_id, NULL) r;
    IF NOT FOUND THEN
      RAISE;
    END IF;
    transaction_id := v_id;
    saldo_baru := v_saldo;
    duplikat := true;
    RETURN NEXT;
    RETURN;
  END;

  -- unnest multi-argumen adalah sintaks khusus FROM dan tidak bisa di-qualify;
  -- tetap aman karena pg_catalog selalu dicari walau search_path = ''.
  INSERT INTO public.transaction_items (transaction_id, waste_type_id, berat, harga_snapshot, subtotal)
  SELECT v_id, x.waste_type_id, x.berat, x.harga, x.subtotal
  FROM unnest(v_waste_type_ids, v_berats, v_hargas, v_subtotals)
    AS x(waste_type_id, berat, harga, subtotal);

  SELECT COALESCE(sum(t.jumlah), 0) INTO v_saldo
  FROM public.transactions t
  WHERE t.customer_id = p_customer_id;

  transaction_id := v_id;
  saldo_baru := v_saldo;
  duplikat := false;
  RETURN NEXT;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION public.tarik(
  p_customer_id text,
  p_admin_id text,
  p_client_request_id uuid,
  p_jumlah integer,
  p_catatan text DEFAULT NULL
)
RETURNS TABLE (transaction_id bigint, saldo_baru bigint, duplikat boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_aktif boolean;
  v_constraint text;
  v_id bigint;
  v_saldo bigint;
BEGIN
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'ISOLATION_LEVEL_TIDAK_DIDUKUNG',
      DETAIL = pg_catalog.format('transaction_isolation=%s', pg_catalog.current_setting('transaction_isolation'));
  END IF;

  -- 1. Idempotency, paling dulu.
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'VALIDASI_GAGAL', DETAIL = 'client_request_id kosong';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(1, pg_catalog.hashtext(p_client_request_id::text));

  SELECT r.transaction_id, r.saldo_baru INTO v_id, v_saldo
  FROM public.cek_request_ulang(p_client_request_id, 'tarik', p_customer_id, p_admin_id, NULL) r;
  IF FOUND THEN
    transaction_id := v_id;
    saldo_baru := v_saldo;
    duplikat := true;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_jumlah IS NULL OR p_jumlah <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'VALIDASI_GAGAL', DETAIL = pg_catalog.format('jumlah=%s', p_jumlah);
  END IF;

  -- 2. Admin
  SELECT u.role, u.aktif INTO v_role, v_aktif FROM public."user" u WHERE u.id = p_admin_id;
  IF NOT FOUND OR v_role NOT IN ('admin', 'super_admin') OR NOT v_aktif THEN
    RAISE EXCEPTION USING MESSAGE = 'TIDAK_DIIZINKAN', DETAIL = pg_catalog.format('admin_id=%s', p_admin_id);
  END IF;

  -- 3. Nasabah. Kunci baris: tarik/koreksi untuk nasabah yang sama berjalan bergantian.
  -- Aturan bisnis: nasabah NONAKTIF tetap boleh ditarik, karena sisa saldo adalah hak
  -- nasabah. Status aktif sengaja tidak dicek di sini (setor tetap wajib aktif).
  SELECT u.role INTO v_role
  FROM public."user" u
  WHERE u.id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND OR v_role <> 'nasabah' THEN
    RAISE EXCEPTION USING MESSAGE = 'NASABAH_TIDAK_DITEMUKAN', DETAIL = pg_catalog.format('customer_id=%s', p_customer_id);
  END IF;

  SELECT COALESCE(sum(t.jumlah), 0) INTO v_saldo
  FROM public.transactions t
  WHERE t.customer_id = p_customer_id;

  IF v_saldo < p_jumlah THEN
    RAISE EXCEPTION USING
      MESSAGE = 'SALDO_TIDAK_CUKUP',
      DETAIL = pg_catalog.format('customer_id=%s saldo=%s diminta=%s', p_customer_id, v_saldo, p_jumlah);
  END IF;

  -- 4. Tulis. unique_violation pada client_request_id = pengaman terakhir race UUID.
  BEGIN
    INSERT INTO public.transactions (customer_id, tipe, jumlah, dibuat_oleh, catatan, client_request_id)
    VALUES (p_customer_id, 'tarik', -p_jumlah, p_admin_id, p_catatan, p_client_request_id)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IS DISTINCT FROM 'transactions_client_request_id_unique' THEN
      RAISE;
    END IF;
    SELECT r.transaction_id, r.saldo_baru INTO v_id, v_saldo
    FROM public.cek_request_ulang(p_client_request_id, 'tarik', p_customer_id, p_admin_id, NULL) r;
    IF NOT FOUND THEN
      RAISE;
    END IF;
    transaction_id := v_id;
    saldo_baru := v_saldo;
    duplikat := true;
    RETURN NEXT;
    RETURN;
  END;

  transaction_id := v_id;
  saldo_baru := v_saldo - p_jumlah;
  duplikat := false;
  RETURN NEXT;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION public.koreksi(
  p_original_id bigint,
  p_admin_id text,
  p_client_request_id uuid,
  p_alasan text
)
RETURNS TABLE (transaction_id bigint, saldo_baru bigint, duplikat boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_aktif boolean;
  v_customer_id text;
  v_tipe text;
  v_jumlah integer;
  v_koreksi_id bigint;
  v_constraint text;
  v_id bigint;
  v_saldo bigint;
BEGIN
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'ISOLATION_LEVEL_TIDAK_DIDUKUNG',
      DETAIL = pg_catalog.format('transaction_isolation=%s', pg_catalog.current_setting('transaction_isolation'));
  END IF;

  -- 1. Idempotency, paling dulu. customer_id koreksi = customer_id transaksi asli.
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'VALIDASI_GAGAL', DETAIL = 'client_request_id kosong';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(1, pg_catalog.hashtext(p_client_request_id::text));

  SELECT t.customer_id, t.tipe, t.jumlah INTO v_customer_id, v_tipe, v_jumlah
  FROM public.transactions t
  WHERE t.id = p_original_id;

  SELECT r.transaction_id, r.saldo_baru INTO v_id, v_saldo
  FROM public.cek_request_ulang(p_client_request_id, 'koreksi', v_customer_id, p_admin_id, p_original_id) r;
  IF FOUND THEN
    transaction_id := v_id;
    saldo_baru := v_saldo;
    duplikat := true;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_original_id IS NULL OR p_alasan IS NULL OR pg_catalog.btrim(p_alasan) = '' THEN
    RAISE EXCEPTION USING MESSAGE = 'VALIDASI_GAGAL', DETAIL = 'original_id/alasan kosong';
  END IF;

  -- 2. Fase 1: hanya super_admin aktif.
  SELECT u.role, u.aktif INTO v_role, v_aktif FROM public."user" u WHERE u.id = p_admin_id;
  IF NOT FOUND OR v_role <> 'super_admin' OR NOT v_aktif THEN
    RAISE EXCEPTION USING MESSAGE = 'TIDAK_DIIZINKAN', DETAIL = pg_catalog.format('admin_id=%s', p_admin_id);
  END IF;

  -- 3. Transaksi asli (sudah dibaca di atas; baris transactions immutable).
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'TRANSAKSI_TIDAK_DITEMUKAN', DETAIL = pg_catalog.format('original_id=%s', p_original_id);
  END IF;
  IF v_tipe = 'koreksi' THEN
    RAISE EXCEPTION USING MESSAGE = 'TRANSAKSI_TIDAK_BISA_DIBALIK', DETAIL = pg_catalog.format('original_id=%s', p_original_id);
  END IF;

  -- 4. Kunci baris nasabah (sama dengan tarik) sebelum cek koreksi ganda & saldo.
  -- Status aktif nasabah sengaja tidak dicek: kesalahan pencatatan tetap harus bisa dibetulkan.
  PERFORM 1 FROM public."user" u WHERE u.id = v_customer_id FOR UPDATE;

  SELECT k.id INTO v_koreksi_id
  FROM public.transactions k
  WHERE k.reverses_id = p_original_id;
  IF FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'TRANSAKSI_SUDAH_DIBALIK',
      DETAIL = pg_catalog.format('original_id=%s koreksi_id=%s', p_original_id, v_koreksi_id);
  END IF;

  SELECT COALESCE(sum(t.jumlah), 0) INTO v_saldo
  FROM public.transactions t
  WHERE t.customer_id = v_customer_id;

  IF v_saldo - v_jumlah < 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'KOREKSI_MEMBUAT_SALDO_MINUS',
      DETAIL = pg_catalog.format('original_id=%s saldo=%s koreksi=%s', p_original_id, v_saldo, -v_jumlah);
  END IF;

  -- 5. Tulis. UNIQUE(reverses_id) & UNIQUE(client_request_id) = pengaman terakhir.
  BEGIN
    INSERT INTO public.transactions (customer_id, tipe, jumlah, dibuat_oleh, catatan, reverses_id, client_request_id)
    VALUES (v_customer_id, 'koreksi', -v_jumlah, p_admin_id, p_alasan, p_original_id, p_client_request_id)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'transactions_reverses_id_unique' THEN
      RAISE EXCEPTION USING MESSAGE = 'TRANSAKSI_SUDAH_DIBALIK', DETAIL = pg_catalog.format('original_id=%s', p_original_id);
    END IF;
    IF v_constraint IS DISTINCT FROM 'transactions_client_request_id_unique' THEN
      RAISE;
    END IF;
    SELECT r.transaction_id, r.saldo_baru INTO v_id, v_saldo
    FROM public.cek_request_ulang(p_client_request_id, 'koreksi', v_customer_id, p_admin_id, p_original_id) r;
    IF NOT FOUND THEN
      RAISE;
    END IF;
    transaction_id := v_id;
    saldo_baru := v_saldo;
    duplikat := true;
    RETURN NEXT;
    RETURN;
  END;

  transaction_id := v_id;
  saldo_baru := v_saldo - v_jumlah;
  duplikat := false;
  RETURN NEXT;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.cek_request_ulang(uuid, text, text, text, bigint) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.setor(text, text, uuid, jsonb, text, text, text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.tarik(text, text, uuid, integer, text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.koreksi(bigint, text, uuid, text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.setor(text, text, uuid, jsonb, text, text, text) TO app_server;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.tarik(text, text, uuid, integer, text) TO app_server;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.koreksi(bigint, text, uuid, text) TO app_server;
