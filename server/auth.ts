// STUB: hanya dipakai `npx auth generate` untuk menghasilkan server/db/auth-schema.ts.
// Wiring auth (secret, route handler, client, session) belum dikerjakan.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  plugins: [username()],
  user: {
    additionalFields: {
      // input: false => tidak bisa diisi client saat sign-up / update-user.
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
});
