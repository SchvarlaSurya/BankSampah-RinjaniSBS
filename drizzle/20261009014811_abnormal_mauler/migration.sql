ALTER TABLE "transactions" DROP CONSTRAINT "transactions_setor_valid", ADD CONSTRAINT "transactions_setor_valid" CHECK ("tipe" <> 'setor' OR (
        "jumlah" > 0
        AND "reverses_id" IS NULL
        AND (
          ("path_foto" IS NULL AND "hash_foto" IS NULL)
          OR ("path_foto" IS NOT NULL AND "hash_foto" IS NOT NULL)
        )
      ));