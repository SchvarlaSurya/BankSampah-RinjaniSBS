-- Hak akses & RLS untuk audit_akun (migration 20261111022100_audit_akun). Log append-only:
-- app_server hanya SELECT & INSERT (tanpa UPDATE/DELETE), anon/authenticated tanpa hak.

REVOKE ALL ON public.audit_akun FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.audit_akun TO app_server;
--> statement-breakpoint
ALTER TABLE public.audit_akun ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_server_select ON public.audit_akun FOR SELECT TO app_server USING (true);
--> statement-breakpoint
CREATE POLICY app_server_insert ON public.audit_akun FOR INSERT TO app_server WITH CHECK (true);
