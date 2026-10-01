-- WAJIB dijalankan setelah pg_restore dari backup (lihat scripts/restore-backup.md).
--
-- Backup dibuat dengan --no-privileges, jadi seluruh GRANT/REVOKE hilang dan fungsi kembali ke
-- default Postgres: EXECUTE untuk PUBLIC. Tanpa skrip ini, anon/authenticated bisa menjalankan
-- setor/tarik/koreksi (SECURITY DEFINER, melewati RLS) dan app_server tidak bisa membaca apa pun.
--
-- Isinya = semua pernyataan hak akses dari migration (roles_privileges_rls, ledger_integrity,
-- ledger_functions, login_limiter_akses). Bila migration baru menambah GRANT/REVOKE, tambahkan
-- juga di sini. Role anon & authenticated harus sudah ada (bawaan Supabase / init script Docker).

\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'app_server') THEN
    CREATE ROLE app_server LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

-- anon & authenticated: tanpa hak apa pun atas objek di schema public.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- app_server (roles_privileges_rls)
GRANT USAGE ON SCHEMA public TO app_server;
GRANT SELECT ON
  public."user", public.session, public.account, public.verification,
  public.waste_types, public.transactions, public.transaction_items
TO app_server;
GRANT INSERT, UPDATE, DELETE ON public."user", public.session, public.account, public.verification TO app_server;
GRANT INSERT, UPDATE ON public.waste_types TO app_server;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.transactions, public.transaction_items
FROM PUBLIC, app_server, anon, authenticated;

-- ledger_integrity
REVOKE ALL ON public.saldo_nasabah FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.saldo_nasabah TO app_server;
REVOKE ALL ON FUNCTION public.tolak_perubahan_ledger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cek_item_transaksi() FROM PUBLIC, anon, authenticated;

-- ledger_functions
REVOKE ALL ON FUNCTION public.cek_request_ulang(uuid, text, text, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.setor(text, text, uuid, jsonb, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tarik(text, text, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.koreksi(bigint, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setor(text, text, uuid, jsonb, text, text, text) TO app_server;
GRANT EXECUTE ON FUNCTION public.tarik(text, text, uuid, integer, text) TO app_server;
GRANT EXECUTE ON FUNCTION public.koreksi(bigint, text, uuid, text) TO app_server;

-- login_limiter_akses
REVOKE ALL ON public.login_gagal_username, public.login_gagal_ip FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.login_gagal_username, public.login_gagal_ip TO app_server;

COMMIT;
