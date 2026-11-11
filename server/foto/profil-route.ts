import "server-only";
import { logServer } from "../errors";
import { sesiDariCookie } from "../guards";
import { bolehLihatFoto, pathFotoProfil } from "./profil";
import { fotoProfilStorage } from "./storage";

const tolak = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });

/**
 * GET /api/foto-profil/[userId]. Tanpa sesi -> 401. Tidak berhak / tidak ada foto -> 404 (sengaja
 * tidak dibedakan, supaya nasabah tidak bisa menebak siapa yang punya foto).
 */
export async function sajikanFotoProfil(userId: string): Promise<Response> {
  try {
    const sesi = await sesiDariCookie();
    if (!sesi) return tolak(401);
    if (userId.length > 64 || !bolehLihatFoto(sesi, userId)) return tolak(404);
    const path = await pathFotoProfil(userId);
    if (!path) return tolak(404);
    const isi = await fotoProfilStorage().baca(path);
    return new Response(new Blob([new Uint8Array(isi)]), {
      headers: {
        "content-type": "image/webp",
        // URL memuat ?v=<versi>: foto baru = URL baru. Cache hanya di browser (private), bukan CDN.
        "cache-control": "private, max-age=86400",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'",
      },
    });
  } catch (e) {
    logServer("fotoProfil", e);
    return tolak(500);
  }
}
