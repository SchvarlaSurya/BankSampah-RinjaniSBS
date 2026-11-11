import "server-only";
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
  // Penyimpanan foto timbangan. "local" hanya untuk dev/tes (disk), "supabase" untuk produksi.
  FOTO_STORAGE: z.enum(["local", "supabase"]).default("local"),
  FOTO_LOCAL_DIR: z.string().min(1).default(".data/foto"),
  SUPABASE_URL: httpUrl.optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  FOTO_BUCKET: z.string().min(1).default("foto-timbangan"),
  // Foto profil: bucket PRIVATE terpisah (supabase) / subfolder "profil" di FOTO_LOCAL_DIR (local).
  FOTO_PROFIL_BUCKET: z.string().min(1).default("foto-profil"),
  // Rahasia GET /api/cron/keepalive (header Authorization: Bearer <CRON_SECRET>). Vercel Cron
  // mengirim header ini otomatis bila env CRON_SECRET di-set. Kosong = endpoint nonaktif (503).
  CRON_SECRET: z.string().min(16, "minimal 16 karakter").optional(),
}).superRefine((v, ctx) => {
  if (v.FOTO_STORAGE === "supabase" && (!v.SUPABASE_URL || !v.SUPABASE_SERVICE_ROLE_KEY)) {
    ctx.addIssue({ code: "custom", path: ["FOTO_STORAGE"], message: "supabase butuh SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY" });
  }
  if (v.FOTO_STORAGE === "local" && v.NODE_ENV === "production") {
    ctx.addIssue({ code: "custom", path: ["FOTO_STORAGE"], message: "local tidak boleh di produksi (disk serverless tidak permanen)" });
  }
});

// DATABASE_URL kosong diperlakukan sama dengan belum di-set.
const parsed = schema.safeParse({
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || undefined,
  CRON_SECRET: process.env.CRON_SECRET || undefined,
});

if (!parsed.success) {
  throw new Error(`Env tidak valid:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
