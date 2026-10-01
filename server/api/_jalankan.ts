import "server-only";
import { type ActionResult, fail } from "@/contract";
import { logServer } from "../errors";
import { type NamaAkses, requireAkses, type SesiServer } from "../guards";

/**
 * Kerangka setiap fungsi backend (kontrak Bagian 8.1): guard (sesi -> wajib ganti password ->
 * AKSES) dulu, baru `fn` yang memvalidasi input dengan zod kontrak lalu menjalankan logika.
 * Kegagalan yang tidak dikenal -> SERVER_ERROR (detail hanya di log server), tidak pernah throw.
 */
export async function jalankan<T>(
  nama: NamaAkses,
  fn: (sesi: SesiServer) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const g = await requireAkses(nama);
    if (!g.ok) return g.hasil;
    return await fn(g.sesi);
  } catch (e) {
    logServer(nama, e);
    return fail("SERVER_ERROR");
  }
}
