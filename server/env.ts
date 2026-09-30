import { z } from "zod";

const postgresUrl = z
  .string()
  .trim()
  .min(1)
  .pipe(z.url({ protocol: /^postgres(ql)?$/ }));

const httpUrl = z
  .string()
  .trim()
  .min(1)
  .pipe(z.url({ protocol: /^https?$/ }));

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: postgresUrl,
  BETTER_AUTH_SECRET: z.string().min(32, "minimal 32 karakter"),
  BETTER_AUTH_URL: httpUrl,
  // Dipisah koma. Kosong = hanya BETTER_AUTH_URL.
  TRUSTED_ORIGINS: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(httpUrl)),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Env tidak valid:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
