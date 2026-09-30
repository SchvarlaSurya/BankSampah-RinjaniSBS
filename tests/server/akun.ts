import { randomBytes } from "node:crypto";
import type { Role } from "@/contract";
import { login } from "@/server/api/actions";
import { buatPenggunaDenganPassword } from "@/server/pengguna";
import { Browser, sebagai } from "./next-headers-mock";

export interface Akun {
  userId: string;
  username: string;
  password: string;
  role: Role;
}

export const usernameAcak = (awalan = "u") => `${awalan}${randomBytes(6).toString("hex")}`;

export async function buatAkun(role: Role, opsi: { mustChangePassword?: boolean } = {}): Promise<Akun> {
  const username = usernameAcak(role[0]);
  const password = `Pw-${randomBytes(8).toString("hex")}`;
  const userId = await buatPenggunaDenganPassword({
    username,
    nama: `Tes ${role}`,
    role,
    password,
    mustChangePassword: opsi.mustChangePassword ?? false,
  });
  return { userId, username, password, role };
}

/**
 * IP unik & acak per pemanggilan: /64 acak di 2001:db8::/32 (prefix dokumentasi), sudah dalam
 * bentuk normal ipKlien. Acak (bukan counter) supaya sisa percobaan dari run sebelumnya di DB
 * yang sama tidak pernah bertabrakan.
 */
export function ipBaru(): string {
  const g = randomBytes(4).toString("hex");
  return `2001:0db8:${g.slice(0, 4)}:${g.slice(4)}:0000:0000:0000:0000`;
}

/** Login lewat action asli; mengembalikan browser yang memegang cookie sesi. */
export async function masuk(akun: Akun, browser = new Browser(ipBaru())) {
  const hasil = await sebagai(browser, () => login({ username: akun.username, password: akun.password }));
  if (!hasil.ok) throw new Error(`login ${akun.username} gagal: ${hasil.code}`);
  return browser;
}
