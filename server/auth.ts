import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { LIMIT } from "@/contract";
import { db } from "./db";
import { account, session, user, verification } from "./db/auth-schema";
import { env } from "./konfigurasi";

/**
 * Handler HTTP Better Auth (/api/auth/*) sengaja TIDAK di-mount: semua jalur auth lewat
 * Server Action yang memanggil auth.api.* langsung, sehingga tidak ada endpoint yang bisa
 * melewati pembatas login, cek akun nonaktif, atau guard kontrak.
 */
export const auth = betterAuth({
  appName: "Bank Sampah",
  // Di tes, peringatan per percobaan login ("User not found", dst.) hanya jadi derau.
  logger: { level: env.NODE_ENV === "test" ? "error" : "warn" },
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL, ...env.TRUSTED_ORIGINS],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    // Tidak ada registrasi publik: pengguna dibuat super_admin (server/pengguna.ts).
    disableSignUp: true,
    minPasswordLength: LIMIT.PASSWORD_MIN,
    maxPasswordLength: LIMIT.PASSWORD_MAKS,
    requireEmailVerification: false,
    // sendResetPassword tidak diisi: reset password via email tidak tersedia.
  },
  // sendVerificationEmail tidak diisi: tidak ada email yang pernah dikirim.
  emailVerification: { sendOnSignUp: false, sendOnSignIn: false },
  session: {
    // Tanpa cookie cache: setiap getSession membaca tabel session, jadi sesi yang dicabut
    // (reset password, nonaktif) langsung tidak berlaku.
    cookieCache: { enabled: false },
  },
  // Limiter bawaan hanya berjalan di handler HTTP (tidak di-mount). Pembatas login ada di
  // server/login-limit.ts dengan tabel DB sendiri.
  rateLimit: { enabled: false },
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for"] },
  },
  user: {
    additionalFields: {
      // input: false => tidak bisa diisi lewat body sign-up / update-user.
      role: {
        type: ["super_admin", "admin", "nasabah"],
        required: true,
        defaultValue: "nasabah",
        input: false,
      },
      mustChangePassword: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
      aktif: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Akun nonaktif tidak pernah mendapat sesi, lewat jalur apa pun.
        before: async (s) => {
          const [u] = await db
            .select({ aktif: user.aktif })
            .from(user)
            .where(eq(user.id, s.userId));
          if (!u?.aktif) return false;
        },
      },
    },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 32,
      // Sama dengan BuatPenggunaInputSchema di kontrak (huruf kecil, angka, . _ -).
      usernameValidator: (u) => /^[a-z0-9._-]+$/.test(u),
    }),
    // Wajib paling akhir: menyalin Set-Cookie dari auth.api.* ke cookies() Next.js.
    nextCookies(),
  ],
});
