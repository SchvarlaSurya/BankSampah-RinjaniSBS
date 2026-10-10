import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { z } from "zod";

const EnvSchema = z
  .object({
    DATABASE_URL: z.string().trim().min(1).pipe(z.url({ protocol: /^postgres(ql)?$/ })).optional(),
    DATABASE_URL_MIGRATE: z.string().trim().min(1).pipe(z.url({ protocol: /^postgres(ql)?$/ })).optional(),
  })
  .transform((val, ctx) => {
    const url = val.DATABASE_URL_MIGRATE || val.DATABASE_URL;
    if (!url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL or DATABASE_URL_MIGRATE must be provided",
      });
      return z.NEVER;
    }
    return {
      DATABASE_URL_MIGRATE: url,
    };
  });

const parsed = EnvSchema.safeParse(process.env);

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

