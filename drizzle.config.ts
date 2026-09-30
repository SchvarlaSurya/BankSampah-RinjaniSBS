import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { z } from "zod";

const parsed = z
  .object({
    DATABASE_URL_MIGRATE: z
      .string()
      .trim()
      .min(1)
      .pipe(z.url({ protocol: /^postgres(ql)?$/ })),
  })
  .safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Env tidak valid:\n${z.prettifyError(parsed.error)}`);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: parsed.data.DATABASE_URL_MIGRATE },
  strict: true,
  verbose: true,
});
