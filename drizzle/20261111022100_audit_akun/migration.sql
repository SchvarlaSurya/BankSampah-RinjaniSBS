CREATE TABLE "audit_akun" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_akun_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"aksi" text NOT NULL,
	"pelaku_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"target_username" text NOT NULL,
	"target_nama" text NOT NULL,
	"target_role" text NOT NULL,
	"alasan" text NOT NULL,
	"waktu" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_akun_aksi_valid" CHECK ("aksi" IN ('hapus_akun')),
	CONSTRAINT "audit_akun_target_role_valid" CHECK ("target_role" IN ('super_admin', 'admin', 'nasabah')),
	CONSTRAINT "audit_akun_alasan_wajib" CHECK (btrim("alasan") <> '')
);
--> statement-breakpoint
CREATE INDEX "audit_akun_pelaku_id_idx" ON "audit_akun" ("pelaku_id");--> statement-breakpoint
CREATE INDEX "audit_akun_waktu_idx" ON "audit_akun" ("waktu" DESC);--> statement-breakpoint
ALTER TABLE "audit_akun" ADD CONSTRAINT "audit_akun_pelaku_id_user_id_fkey" FOREIGN KEY ("pelaku_id") REFERENCES "user"("id");