-- Hak akses & RLS untuk tabel foto profil (migration 20261111023951_foto_profil).
-- anon/authenticated tanpa hak. foto_profil: UPSERT/hapus oleh server. foto_profil_unggah: log
-- pembatas unggahan (SELECT, INSERT; DELETE ikut CASCADE saat akun dihapus).

REVOKE ALL ON public.foto_profil, public.foto_profil_unggah FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foto_profil TO app_server;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.foto_profil_unggah TO app_server;
--> statement-breakpoint
ALTER TABLE public.foto_profil ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.foto_profil_unggah ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_server_all ON public.foto_profil
  FOR ALL TO app_server USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_server_select ON public.foto_profil_unggah FOR SELECT TO app_server USING (true);
--> statement-breakpoint
CREATE POLICY app_server_insert ON public.foto_profil_unggah FOR INSERT TO app_server WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_server_delete ON public.foto_profil_unggah FOR DELETE TO app_server USING (true);
