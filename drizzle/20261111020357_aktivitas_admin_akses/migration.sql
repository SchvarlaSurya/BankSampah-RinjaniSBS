-- Hak akses & RLS untuk tabel aktivitas admin (migration 20261111020325_aktivitas_admin).
-- Sama seperti tabel lain: anon/authenticated tidak punya hak maupun policy.
-- admin_login_day & admin_presence: UPSERT oleh server; baris ikut terhapus bersama akun (CASCADE),
-- jadi app_server juga butuh DELETE. system_keepalive: hanya UPSERT dari cron.

REVOKE ALL ON public.admin_login_day, public.admin_presence, public.system_keepalive
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_login_day, public.admin_presence TO app_server;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.system_keepalive TO app_server;
--> statement-breakpoint
ALTER TABLE public.admin_login_day ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.admin_presence ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.system_keepalive ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_server_all ON public.admin_login_day
  FOR ALL TO app_server USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_server_all ON public.admin_presence
  FOR ALL TO app_server USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_server_select ON public.system_keepalive FOR SELECT TO app_server USING (true);
--> statement-breakpoint
CREATE POLICY app_server_insert ON public.system_keepalive FOR INSERT TO app_server WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_server_update ON public.system_keepalive
  FOR UPDATE TO app_server USING (true) WITH CHECK (true);
