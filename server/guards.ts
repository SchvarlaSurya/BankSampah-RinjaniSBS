import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import {
  type ActionResult,
  AKSES,
  type Actions,
  BOLEH_SAAT_WAJIB_GANTI_PASSWORD,
  fail,
  type Queries,
  type Role,
} from "@/contract";
import { auth } from "./auth";
import { db } from "./db";
import { user } from "./db/auth-schema";
import { hapusSemuaSesi } from "./pengguna";

export type NamaAkses = keyof Queries | keyof Actions;

export interface SesiServer {
  userId: string;
  username: string;
  nama: string;
  role: Role;
  mustChangePassword: boolean;
  /** Token sesi request ini (untuk mencabut sesi LAIN saat ganti password). */
  sessionToken: string;
}

export type HasilGuard =
  { ok: true; sesi: SesiServer } | { ok: false; hasil: ActionResult<never> };

/**
 * Sesi dari cookie + data pengguna yang dibaca ULANG dari DB pada request ini.
 * null = tidak login. Sesi milik akun nonaktif (atau user yang sudah hilang) dihapus.
 */
export async function sesiDariCookie(): Promise<SesiServer | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const [u] = await db
    .select({
      id: user.id,
      username: user.username,
      nama: user.name,
      role: user.role,
      aktif: user.aktif,
      mustChangePassword: user.mustChangePassword,
    })
    .from(user)
    .where(eq(user.id, s.user.id));
  if (!u || !u.aktif) {
    await hapusSemuaSesi(s.user.id);
    return null;
  }
  return {
    userId: u.id,
    username: u.username ?? "",
    nama: u.nama,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
    sessionToken: s.session.token,
  };
}

/**
 * Urutan kontrak (Bagian 8.1), tidak boleh dibalik:
 * 1. sesi (tidak ada / akun nonaktif) -> TIDAK_LOGIN
 * 2. mustChangePassword, kecuali BOLEH_SAAT_WAJIB_GANTI_PASSWORD -> WAJIB_GANTI_PASSWORD
 * 3. AKSES[nama] dengan role dari DB -> TIDAK_DIIZINKAN
 * Validasi input (4) dan logika (5) dilakukan pemanggil setelah guard lolos.
 *
 * `login` tidak memakai guard: satu-satunya fungsi yang dipanggil tanpa sesi.
 */
export async function requireAkses(nama: NamaAkses): Promise<HasilGuard> {
  const sesi = await sesiDariCookie();
  if (!sesi) return { ok: false, hasil: fail("TIDAK_LOGIN") };

  if (
    sesi.mustChangePassword &&
    !(BOLEH_SAAT_WAJIB_GANTI_PASSWORD as readonly string[]).includes(nama)
  ) {
    return { ok: false, hasil: fail("WAJIB_GANTI_PASSWORD") };
  }

  if (!AKSES[nama].includes(sesi.role))
    return { ok: false, hasil: fail("TIDAK_DIIZINKAN") };

  return { ok: true, sesi };
}
