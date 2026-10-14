-- Penyesuaian saldo oleh admin/super_admin: transaksi baru bertipe 'penyesuaian' dengan jumlah
-- bertanda (+ menambah, - mengurangi) dan alasan wajib. Ledger tetap append-only; fungsi
-- setor/tarik/koreksi/cek_request_ulang TIDAK diubah. Pola sama dengan tarik:
-- READ COMMITTED, idempotency (namespace 1), lalu kunci baris nasabah FOR UPDATE.
-- Kode error (MESSAGE persis): VALIDASI_GAGAL, TIDAK_DIIZINKAN, NASABAH_TIDAK_DITEMUKAN,
-- SALDO_TIDAK_CUKUP (penyesuaian negatif yang membuat saldo minus).

CREATE FUNCTION public.penyesuaian(
  p_customer_id text,
  p_admin_id text,
  p_client_request_id uuid,
  p_jumlah integer,
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
  FROM public.cek_request_ulang(p_client_request_id, 'penyesuaian', p_customer_id, p_admin_id, NULL) r;
  IF FOUND THEN
    transaction_id := v_id;
    saldo_baru := v_saldo;
    duplikat := true;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_jumlah IS NULL OR p_jumlah = 0 OR p_alasan IS NULL OR pg_catalog.btrim(p_alasan) = '' THEN
    RAISE EXCEPTION USING MESSAGE = 'VALIDASI_GAGAL', DETAIL = pg_catalog.format('jumlah=%s alasan kosong=%s', p_jumlah, p_alasan IS NULL);
  END IF;

  -- 2. Admin / super_admin aktif.
  SELECT u.role, u.aktif INTO v_role, v_aktif FROM public."user" u WHERE u.id = p_admin_id;
  IF NOT FOUND OR v_role NOT IN ('admin', 'super_admin') OR NOT v_aktif THEN
    RAISE EXCEPTION USING MESSAGE = 'TIDAK_DIIZINKAN', DETAIL = pg_catalog.format('admin_id=%s', p_admin_id);
  END IF;

  -- 3. Nasabah (status aktif tidak dicek, sama dengan tarik/koreksi). Kunci baris supaya
  -- tarik/koreksi/penyesuaian untuk nasabah yang sama berjalan bergantian.
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

  IF v_saldo + p_jumlah < 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'SALDO_TIDAK_CUKUP',
      DETAIL = pg_catalog.format('customer_id=%s saldo=%s penyesuaian=%s', p_customer_id, v_saldo, p_jumlah);
  END IF;

  -- 4. Tulis. unique_violation pada client_request_id = pengaman terakhir race UUID.
  BEGIN
    INSERT INTO public.transactions (customer_id, tipe, jumlah, dibuat_oleh, catatan, client_request_id)
    VALUES (p_customer_id, 'penyesuaian', p_jumlah, p_admin_id, pg_catalog.btrim(p_alasan), p_client_request_id)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IS DISTINCT FROM 'transactions_client_request_id_unique' THEN
      RAISE;
    END IF;
    SELECT r.transaction_id, r.saldo_baru INTO v_id, v_saldo
    FROM public.cek_request_ulang(p_client_request_id, 'penyesuaian', p_customer_id, p_admin_id, NULL) r;
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
  saldo_baru := v_saldo + p_jumlah;
  duplikat := false;
  RETURN NEXT;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.penyesuaian(text, text, uuid, integer, text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.penyesuaian(text, text, uuid, integer, text) TO app_server;
