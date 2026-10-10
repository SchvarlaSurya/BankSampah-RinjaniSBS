CREATE TABLE "price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"sampah_id" bigint NOT NULL,
	"harga_lama" integer NOT NULL,
	"harga_baru" integer NOT NULL,
	"diubah_oleh" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "price_history_sampah_id_idx" ON "price_history" ("sampah_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "price_history_created_at_idx" ON "price_history" ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "price_history_diubah_oleh_idx" ON "price_history" ("diubah_oleh");--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_sampah_id_waste_types_id_fkey" FOREIGN KEY ("sampah_id") REFERENCES "waste_types"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_diubah_oleh_user_id_fkey" FOREIGN KEY ("diubah_oleh") REFERENCES "user"("id");