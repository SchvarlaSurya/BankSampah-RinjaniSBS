-- Hak akses & RLS untuk tabel pembatas login. Sama seperti tabel lain:
-- anon/authenticated tidak punya hak maupun policy; app_server hanya yang dibutuhkan.

REVOKE ALL ON public.login_gagal_username, public.login_gagal_ip FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.login_gagal_username, public.login_gagal_ip TO app_server;
--> statement-breakpoint
ALTER TABLE public.login_gagal_username ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.login_gagal_ip ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_server_select ON public.login_gagal_username FOR SELECT TO app_server USING (true);
--> statement-breakpoint
CREATE POLICY app_server_insert ON public.login_gagal_username FOR INSERT TO app_server WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_server_delete ON public.login_gagal_username FOR DELETE TO app_server USING (true);
--> statement-breakpoint
CREATE POLICY app_server_select ON public.login_gagal_ip FOR SELECT TO app_server USING (true);
--> statement-breakpoint
CREATE POLICY app_server_insert ON public.login_gagal_ip FOR INSERT TO app_server WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_server_delete ON public.login_gagal_ip FOR DELETE TO app_server USING (true);
