-- Role runtime server, hak akses, dan RLS.
-- Dijalankan sebagai owner (DATABASE_URL_MIGRATE). Role anon & authenticated harus sudah ada
-- (bawaan Supabase; di lokal dibuat oleh docker/postgres/init/01-supabase-roles.sql).

-- app_server: LOGIN tanpa password. Password di-set manual di luar migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'app_server') THEN
    CREATE ROLE app_server LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint

-- anon & authenticated: cabut semua hak atas objek di schema public.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- Objek baru yang dibuat role migration ini tidak otomatis terbuka.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
--> statement-breakpoint
-- EXECUTE ke PUBLIC adalah default global, tidak bisa dicabut per schema.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint

-- Hak app_server. transactions & transaction_items hanya SELECT; penulisan lewat
-- fungsi SECURITY DEFINER setor/tarik/koreksi (migration berikutnya).
GRANT USAGE ON SCHEMA public TO app_server;
--> statement-breakpoint
GRANT SELECT ON
  public."user", public.session, public.account, public.verification,
  public.waste_types, public.transactions, public.transaction_items
TO app_server;
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON
  public."user", public.session, public.account, public.verification
TO app_server;
--> statement-breakpoint
-- waste_types tidak pernah dihapus, hanya dinonaktifkan.
GRANT INSERT, UPDATE ON public.waste_types TO app_server;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.transactions, public.transaction_items
FROM PUBLIC, app_server, anon, authenticated;
--> statement-breakpoint

-- RLS di semua tabel. Hanya app_server yang punya policy; anon/authenticated tidak.
ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.account ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.verification ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.waste_types ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY app_server_all ON public."user"
  FOR ALL TO app_server USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_server_all ON public.session
  FOR ALL TO app_server USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_server_all ON public.account
  FOR ALL TO app_server USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_server_all ON public.verification
  FOR ALL TO app_server USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_server_select ON public.waste_types
  FOR SELECT TO app_server USING (true);
--> statement-breakpoint
CREATE POLICY app_server_insert ON public.waste_types
  FOR INSERT TO app_server WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_server_update ON public.waste_types
  FOR UPDATE TO app_server USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_server_select ON public.transactions
  FOR SELECT TO app_server USING (true);
--> statement-breakpoint
CREATE POLICY app_server_select ON public.transaction_items
  FOR SELECT TO app_server USING (true);
