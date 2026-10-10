import { randomInt } from "node:crypto";
import type { Role } from "@/contract";
import { auth } from "./auth";

/** Tanpa 0/O/1/l/I supaya tidak tertukar saat dibacakan / diketik ulang. */
const ALFABET_PASSWORD =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function buatPasswordSementara(panjang = 12): string {
  let hasil = "";
  for (let i = 0; i < panjang; i++)
    hasil += ALFABET_PASSWORD[randomInt(ALFABET_PASSWORD.length)];
  return hasil;
}

/** Better Auth mewajibkan email unik; pengguna bank sampah tidak memakai email. */
export const emailBuatan = (username: string) =>
  `${username}@bank-sampah.invalid`;

/**
 * Buat pengguna + akun credential lewat jalur internal resmi Better Auth:
 * `ctx.password.hash` (hash bawaan Better Auth, sama dengan yang dipakai sign-in untuk
 * verifikasi), `internalAdapter.createUser`, lalu `internalAdapter.linkAccount` dengan
 * providerId "credential" dan accountId = userId (bentuk yang dipakai sign-up email dan
 * `internalAdapter.updatePassword`). Endpoint sign-up tidak dipakai karena disableSignUp.
 */
export async function buatPenggunaDenganPassword(data: {
  username: string;
  nama: string;
  role: Role;
  password: string;
  mustChangePassword: boolean;
}): Promise<string> {
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(data.password);
  const u = await ctx.internalAdapter.createUser(
    {
      email: emailBuatan(data.username),
      name: data.nama,
      emailVerified: false,
      username: data.username,
      displayUsername: data.username,
      role: data.role,
      mustChangePassword: data.mustChangePassword,
      aktif: true,
    },
    { method: "admin" },
  );
  try {
    await ctx.internalAdapter.linkAccount({
      userId: u.id,
      providerId: "credential",
      accountId: u.id,
      password: hash,
    });
  } catch (e) {
    // Dua insert terpisah: jangan tinggalkan user tanpa password.
    await ctx.internalAdapter.deleteUser(u.id);
    throw e;
  }
  return u.id;
}

/** Cabut semua sesi pengguna (reset password, nonaktif, sesi akun nonaktif). */
export async function hapusSemuaSesi(userId: string): Promise<void> {
  const ctx = await auth.$context;
  await ctx.internalAdapter.deleteUserSessions(userId);
}
