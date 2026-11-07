-- Hak akses & RLS untuk price_history (tabel dari migration 20261009033635_peaceful_shen, dibuat
-- tanpa GRANT untuk app_server dan tanpa RLS). Sama seperti tabel lain: anon/authenticated tidak
-- punya hak maupun policy. Riwayat harga = log append-only: app_server hanya SELECT & INSERT.

REVOKE ALL ON public.price_history FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.price_history TO app_server;
--> statement-breakpoint
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_server_select ON public.price_history FOR SELECT TO app_server USING (true);
--> statement-breakpoint
CREATE POLICY app_server_insert ON public.price_history FOR INSERT TO app_server WITH CHECK (true);
