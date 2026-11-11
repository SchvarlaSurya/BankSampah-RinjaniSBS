CREATE TABLE "foto_profil" (
	"user_id" text PRIMARY KEY,
	"path" text NOT NULL,
	"diperbarui_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foto_profil_unggah" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "foto_profil_unggah_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"waktu" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "foto_profil_unggah_user_id_waktu_idx" ON "foto_profil_unggah" ("user_id","waktu" DESC);--> statement-breakpoint
ALTER TABLE "foto_profil" ADD CONSTRAINT "foto_profil_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "foto_profil_unggah" ADD CONSTRAINT "foto_profil_unggah_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;