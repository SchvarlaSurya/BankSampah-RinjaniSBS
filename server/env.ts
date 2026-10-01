import { z } from "zod";

const postgresUrl = z
  .string()
  .trim()
  .min(1)
  .pipe(z.url({ protocol: /^postgres(ql)?$/ }));

const schema = z.object({
  DATABASE_URL: postgresUrl.default("postgresql://postgres:postgres@localhost:5432/postgres"),
});

const parsed = schema.safeParse({
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || undefined,
});

if (!parsed.success) {
  throw new Error(
    `Env tidak valid:\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = parsed.data;
