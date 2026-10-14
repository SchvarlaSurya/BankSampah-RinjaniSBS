/**
 * lib/api/mock/_guard.ts
 *
 * Guard mock dengan urutan yang sama seperti backend (kontrak Bagian 8.1, server/guards.ts):
 * sesi -> akun masih aktif (dibaca ulang tiap panggilan) -> wajib ganti password -> AKSES.
 */

import "server-only";
import { AKSES, BOLEH_SAAT_WAJIB_GANTI_PASSWORD, fail, type ActionResult, type SesiInfo } from "@/contract";
import { store } from "./_store";

export type NamaAkses = keyof typeof AKSES;

export function guard(nama: NamaAkses): { ok: true; sesi: SesiInfo } | { ok: false; hasil: ActionResult<never> } {
  const sesi = store.sesi;
  if (!sesi) return { ok: false, hasil: fail("TIDAK_LOGIN") };

  // Backend membaca ulang user dari DB: akun nonaktif -> sesi dihapus, TIDAK_LOGIN.
  const akun = store.usersById.get(sesi.userId);
  if (!akun || !akun.aktif) {
    store.sesi = null;
    return { ok: false, hasil: fail("TIDAK_LOGIN") };
  }

  const bebas = (BOLEH_SAAT_WAJIB_GANTI_PASSWORD as readonly string[]).includes(nama);
  if (sesi.mustChangePassword && !bebas) return { ok: false, hasil: fail("WAJIB_GANTI_PASSWORD") };
  if (!AKSES[nama].includes(sesi.role)) return { ok: false, hasil: fail("TIDAK_DIIZINKAN") };
  return { ok: true, sesi };
}
