ALTER TABLE "transactions" ADD CONSTRAINT "transactions_penyesuaian_valid" CHECK ("tipe" <> 'penyesuaian' OR (
        "reverses_id" IS NULL
        AND "path_foto" IS NULL
        AND "hash_foto" IS NULL
        AND "catatan" IS NOT NULL
        AND btrim("catatan") <> ''
      ));--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_tipe_valid", ADD CONSTRAINT "transactions_tipe_valid" CHECK ("tipe" IN ('setor', 'tarik', 'koreksi', 'penyesuaian'));