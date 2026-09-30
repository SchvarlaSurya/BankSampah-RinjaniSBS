-- Fungsi keuangan: satu-satunya jalur tulis ke transactions & transaction_items.
-- SECURITY DEFINER (jalan sebagai owner), search_path kosong, semua nama schema-qualified.
--
-- Wajib READ COMMITTED: pengecekan saldo & hash foto mengandalkan snapshot baru per
-- statement setelah lock diperoleh. Di REPEATABLE READ / SERIALIZABLE snapshot diambil
-- di awal transaksi, sehingga dua tarik paralel bisa sama-sama lolos.

CREATE FUNCTION public.setor(
  p_customer_id text,
  p_admin_id text,
  p_items jsonb,
  p_path_foto text,
  p_hash_foto text,
  p_catatan text DEFAULT NULL
)
RETURNS bigint
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
  v_nama text;
  v_harga integer;
  v_harga_aktif boolean;
  v_subtotal numeric;
  v_total numeric := 0;
  v_waste_type_ids bigint[] := '{}';
  v_berats numeric[] := '{}';
  v_hargas integer[] := '{}';
  v_subtotals integer[] := '{}';
  v_transaksi_aktif bigint;
  v_id bigint;
BEGIN
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'setor() harus dijalankan dengan isolation level READ COMMITTED (sekarang: %).',
      pg_catalog.current_setting('transaction_isolation');
  END IF;

  -- Admin
  SELECT u.role, u.aktif INTO v_role, v_aktif FROM public."user" u WHERE u.id = p_admin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin dengan id % tidak ditemukan.', p_admin_id;
  END IF;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'User % tidak berhak mencatat setor: role % (harus admin atau super_admin).', p_admin_id, v_role;
  END IF;
  IF NOT v_aktif THEN
    RAISE EXCEPTION 'Admin % tidak aktif.', p_admin_id;
  END IF;

  -- Nasabah
  SELECT u.role, u.aktif INTO v_role, v_aktif FROM public."user" u WHERE u.id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nasabah dengan id % tidak ditemukan.', p_customer_id;
  END IF;
  IF v_role <> 'nasabah' THEN
    RAISE EXCEPTION 'User % bukan nasabah (role: %).', p_customer_id, v_role;
  END IF;
  IF NOT v_aktif THEN
    RAISE EXCEPTION 'Nasabah % tidak aktif.', p_customer_id;
  END IF;

  -- Foto
  IF p_path_foto IS NULL OR pg_catalog.btrim(p_path_foto) = '' THEN
    RAISE EXCEPTION 'path_foto wajib diisi untuk setor.';
  END IF;
  IF p_hash_foto IS NULL OR pg_catalog.btrim(p_hash_foto) = '' THEN
    RAISE EXCEPTION 'hash_foto wajib diisi untuk setor.';
  END IF;

  -- Item. Harga SELALU diambil dari waste_types, bukan dari client.
  IF p_items IS NULL
     OR pg_catalog.jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'p_items harus array JSON berisi minimal 1 item [{waste_type_id, berat}].';
  END IF;

  FOR v_item, v_urutan IN
    SELECT e.value, e.ordinality
    FROM pg_catalog.jsonb_array_elements(p_items) WITH ORDINALITY AS e(value, ordinality)
  LOOP
    IF pg_catalog.jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Item ke-% harus berupa object {waste_type_id, berat}.', v_urutan;
    END IF;

    IF pg_catalog.jsonb_typeof(v_item -> 'waste_type_id') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Item ke-%: waste_type_id wajib berupa angka.', v_urutan;
    END IF;
    v_id_num := (v_item ->> 'waste_type_id')::numeric;
    IF v_id_num <> pg_catalog.trunc(v_id_num) OR v_id_num <= 0 THEN
      RAISE EXCEPTION 'Item ke-%: waste_type_id % tidak valid.', v_urutan, v_id_num;
    END IF;
    v_waste_type_id := v_id_num::bigint;

    IF pg_catalog.jsonb_typeof(v_item -> 'berat') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Item ke-%: berat wajib berupa angka (kg).', v_urutan;
    END IF;
    v_berat := (v_item ->> 'berat')::numeric;
    IF v_berat <= 0 THEN
      RAISE EXCEPTION 'Item ke-%: berat harus > 0 (diterima: %).', v_urutan, v_berat;
    END IF;
    IF v_berat <> pg_catalog.round(v_berat, 2) THEN
      RAISE EXCEPTION 'Item ke-%: berat maksimal 2 angka desimal (diterima: %).', v_urutan, v_berat;
    END IF;
    IF v_berat >= 100000000 THEN
      RAISE EXCEPTION 'Item ke-%: berat terlalu besar (diterima: %).', v_urutan, v_berat;
    END IF;

    SELECT w.nama, w.harga_beli, w.aktif INTO v_nama, v_harga, v_harga_aktif
    FROM public.waste_types w
    WHERE w.id = v_waste_type_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item ke-%: jenis sampah dengan id % tidak ditemukan.', v_urutan, v_waste_type_id;
    END IF;
    IF NOT v_harga_aktif THEN
      RAISE EXCEPTION 'Item ke-%: jenis sampah "%" tidak aktif.', v_urutan, v_nama;
    END IF;

    v_subtotal := pg_catalog.round(v_berat * v_harga);
    IF v_subtotal <= 0 THEN
      RAISE EXCEPTION 'Item ke-% ("%"): subtotal Rp0 (% kg x Rp%/kg dibulatkan). Berat terlalu kecil.',
        v_urutan, v_nama, v_berat, v_harga;
    END IF;
    IF v_subtotal > 2147483647 THEN
      RAISE EXCEPTION 'Item ke-% ("%"): subtotal Rp% melebihi batas.', v_urutan, v_nama, v_subtotal;
    END IF;

    v_total := v_total + v_subtotal;
    IF v_total > 2147483647 THEN
      RAISE EXCEPTION 'Total setor melebihi batas (Rp%).', v_total;
    END IF;

    v_waste_type_ids := v_waste_type_ids || v_waste_type_id;
    v_berats := v_berats || v_berat;
    v_hargas := v_hargas || v_harga;
    v_subtotals := v_subtotals || v_subtotal::integer;
  END LOOP;

  -- Hash foto hanya boleh dipakai ulang kalau setor sebelumnya sudah dibalik.
  -- Lock menyerialkan setor dengan hash yang sama; cek di bawah memakai snapshot baru.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_hash_foto));

  SELECT t.id INTO v_transaksi_aktif
  FROM public.transactions t
  WHERE t.hash_foto = p_hash_foto
    AND t.tipe = 'setor'
    AND NOT EXISTS (SELECT 1 FROM public.transactions k WHERE k.reverses_id = t.id)
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Foto sudah dipakai di transaksi setor #% yang belum dikoreksi.', v_transaksi_aktif;
  END IF;

  INSERT INTO public.transactions (customer_id, tipe, jumlah, dibuat_oleh, catatan, path_foto, hash_foto)
  VALUES (p_customer_id, 'setor', v_total::integer, p_admin_id, p_catatan, p_path_foto, p_hash_foto)
  RETURNING id INTO v_id;

  INSERT INTO public.transaction_items (transaction_id, waste_type_id, berat, harga_snapshot, subtotal)
  SELECT v_id, x.waste_type_id, x.berat, x.harga, x.subtotal
  -- unnest multi-argumen adalah sintaks khusus FROM dan tidak bisa di-qualify;
  -- tetap aman karena pg_catalog selalu dicari walau search_path = ''.
  FROM unnest(v_waste_type_ids, v_berats, v_hargas, v_subtotals)
    AS x(waste_type_id, berat, harga, subtotal);

  RETURN v_id;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION public.tarik(
  p_customer_id text,
  p_admin_id text,
  p_jumlah integer,
  p_catatan text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_aktif boolean;
  v_saldo bigint;
  v_id bigint;
BEGIN
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'tarik() harus dijalankan dengan isolation level READ COMMITTED (sekarang: %).',
      pg_catalog.current_setting('transaction_isolation');
  END IF;

  IF p_jumlah IS NULL OR p_jumlah <= 0 THEN
    RAISE EXCEPTION 'Jumlah tarik harus bilangan bulat > 0 (diterima: %).', p_jumlah;
  END IF;

  -- Admin
  SELECT u.role, u.aktif INTO v_role, v_aktif FROM public."user" u WHERE u.id = p_admin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin dengan id % tidak ditemukan.', p_admin_id;
  END IF;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'User % tidak berhak mencatat tarik: role % (harus admin atau super_admin).', p_admin_id, v_role;
  END IF;
  IF NOT v_aktif THEN
    RAISE EXCEPTION 'Admin % tidak aktif.', p_admin_id;
  END IF;

  -- Kunci baris nasabah: tarik/koreksi untuk nasabah yang sama berjalan bergantian.
  SELECT u.role, u.aktif INTO v_role, v_aktif
  FROM public."user" u
  WHERE u.id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nasabah dengan id % tidak ditemukan.', p_customer_id;
  END IF;
  IF v_role <> 'nasabah' THEN
    RAISE EXCEPTION 'User % bukan nasabah (role: %).', p_customer_id, v_role;
  END IF;
  IF NOT v_aktif THEN
    RAISE EXCEPTION 'Nasabah % tidak aktif.', p_customer_id;
  END IF;

  SELECT COALESCE(sum(t.jumlah), 0) INTO v_saldo
  FROM public.transactions t
  WHERE t.customer_id = p_customer_id;

  IF v_saldo < p_jumlah THEN
    RAISE EXCEPTION 'Saldo tidak cukup: saldo Rp%, diminta Rp%.', v_saldo, p_jumlah;
  END IF;

  INSERT INTO public.transactions (customer_id, tipe, jumlah, dibuat_oleh, catatan)
  VALUES (p_customer_id, 'tarik', -p_jumlah, p_admin_id, p_catatan)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION public.koreksi(
  p_original_id bigint,
  p_admin_id text,
  p_alasan text
)
RETURNS bigint
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
  v_saldo bigint;
  v_id bigint;
BEGIN
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'koreksi() harus dijalankan dengan isolation level READ COMMITTED (sekarang: %).',
      pg_catalog.current_setting('transaction_isolation');
  END IF;

  IF p_alasan IS NULL OR pg_catalog.btrim(p_alasan) = '' THEN
    RAISE EXCEPTION 'Alasan koreksi wajib diisi.';
  END IF;

  -- Fase 1: hanya super_admin.
  SELECT u.role, u.aktif INTO v_role, v_aktif FROM public."user" u WHERE u.id = p_admin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin dengan id % tidak ditemukan.', p_admin_id;
  END IF;
  IF v_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Koreksi hanya boleh dilakukan super_admin (user % ber-role %).', p_admin_id, v_role;
  END IF;
  IF NOT v_aktif THEN
    RAISE EXCEPTION 'Super admin % tidak aktif.', p_admin_id;
  END IF;

  SELECT t.customer_id, t.tipe, t.jumlah INTO v_customer_id, v_tipe, v_jumlah
  FROM public.transactions t
  WHERE t.id = p_original_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi #% tidak ditemukan.', p_original_id;
  END IF;
  IF v_tipe = 'koreksi' THEN
    RAISE EXCEPTION 'Transaksi #% adalah koreksi; koreksi atas koreksi tidak diizinkan.', p_original_id;
  END IF;

  -- Kunci baris nasabah (sama dengan tarik) sebelum cek koreksi ganda & saldo.
  PERFORM 1 FROM public."user" u WHERE u.id = v_customer_id FOR UPDATE;

  SELECT k.id INTO v_koreksi_id
  FROM public.transactions k
  WHERE k.reverses_id = p_original_id;
  IF FOUND THEN
    RAISE EXCEPTION 'Transaksi #% sudah pernah dikoreksi oleh transaksi #%.', p_original_id, v_koreksi_id;
  END IF;

  SELECT COALESCE(sum(t.jumlah), 0) INTO v_saldo
  FROM public.transactions t
  WHERE t.customer_id = v_customer_id;

  IF v_saldo - v_jumlah < 0 THEN
    RAISE EXCEPTION 'Koreksi transaksi #% ditolak: saldo nasabah akan menjadi Rp% (saldo sekarang Rp%, koreksi Rp%).',
      p_original_id, v_saldo - v_jumlah, v_saldo, -v_jumlah;
  END IF;

  BEGIN
    INSERT INTO public.transactions (customer_id, tipe, jumlah, dibuat_oleh, catatan, reverses_id)
    VALUES (v_customer_id, 'koreksi', -v_jumlah, p_admin_id, p_alasan, p_original_id)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    -- Pengaman terakhir: UNIQUE(reverses_id).
    RAISE EXCEPTION 'Transaksi #% sudah pernah dikoreksi.', p_original_id;
  END;

  RETURN v_id;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.setor(text, text, jsonb, text, text, text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.tarik(text, text, integer, text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.koreksi(bigint, text, text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.setor(text, text, jsonb, text, text, text) TO app_server;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.tarik(text, text, integer, text) TO app_server;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.koreksi(bigint, text, text) TO app_server;
