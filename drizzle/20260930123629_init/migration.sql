CREATE TABLE "transaction_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transaction_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"transaction_id" bigint NOT NULL,
	"waste_type_id" bigint NOT NULL,
	"berat" numeric(10,2) NOT NULL,
	"harga_snapshot" integer NOT NULL,
	"subtotal" integer NOT NULL,
	CONSTRAINT "transaction_items_berat_positif" CHECK ("berat" > 0),
	CONSTRAINT "transaction_items_harga_snapshot_positif" CHECK ("harga_snapshot" > 0),
	CONSTRAINT "transaction_items_subtotal_positif" CHECK ("subtotal" > 0),
	CONSTRAINT "transaction_items_subtotal_konsisten" CHECK ("subtotal" = round("berat" * "harga_snapshot"))
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"customer_id" text NOT NULL,
	"tipe" text NOT NULL,
	"jumlah" integer NOT NULL,
	"dibuat_oleh" text NOT NULL,
	"waktu" timestamp with time zone DEFAULT now() NOT NULL,
	"catatan" text,
	"reverses_id" bigint CONSTRAINT "transactions_reverses_id_unique" UNIQUE,
	"path_foto" text,
	"hash_foto" text,
	CONSTRAINT "transactions_tipe_valid" CHECK ("tipe" IN ('setor', 'tarik', 'koreksi')),
	CONSTRAINT "transactions_jumlah_bukan_nol" CHECK ("jumlah" <> 0),
	CONSTRAINT "transactions_setor_valid" CHECK ("tipe" <> 'setor' OR (
        "jumlah" > 0
        AND "reverses_id" IS NULL
        AND "path_foto" IS NOT NULL
        AND "hash_foto" IS NOT NULL
      )),
	CONSTRAINT "transactions_tarik_valid" CHECK ("tipe" <> 'tarik' OR ("jumlah" < 0 AND "reverses_id" IS NULL)),
	CONSTRAINT "transactions_koreksi_valid" CHECK ("tipe" <> 'koreksi' OR (
        "reverses_id" IS NOT NULL
        AND "catatan" IS NOT NULL
        AND btrim("catatan") <> ''
      ))
);
--> statement-breakpoint
CREATE TABLE "waste_types" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "waste_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nama" text NOT NULL,
	"harga_beli" integer NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	CONSTRAINT "waste_types_harga_beli_positif" CHECK ("harga_beli" > 0)
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"username" text UNIQUE,
	"display_username" text,
	"role" text DEFAULT 'nasabah' NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	CONSTRAINT "user_role_valid" CHECK ("role" IN ('super_admin', 'admin', 'nasabah'))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "transaction_items_transaction_id_idx" ON "transaction_items" ("transaction_id");--> statement-breakpoint
CREATE INDEX "transactions_hash_foto_idx" ON "transactions" ("hash_foto");--> statement-breakpoint
CREATE INDEX "transactions_customer_id_idx" ON "transactions" ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waste_types_nama_unique" ON "waste_types" (lower(btrim("nama")));--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_transactions_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id");--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_waste_type_id_waste_types_id_fkey" FOREIGN KEY ("waste_type_id") REFERENCES "waste_types"("id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_user_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_dibuat_oleh_user_id_fkey" FOREIGN KEY ("dibuat_oleh") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "transactions"("id");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;