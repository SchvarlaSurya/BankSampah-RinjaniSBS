import "server-only";
import { env } from "../konfigurasi";
import { sesiDariCookie } from "../guards";
import { fotoStorageLokal, POLA_NAMA_FOTO, urlLokalSah } from "./lokal";

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

const tolak = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });

/**
 * Sajikan foto dari FOTO_LOCAL_DIR untuk route dev. Syarat: bukan produksi, FOTO_STORAGE=local,
 * sesi super_admin (dibaca dari DB), dan URL bertanda tangan yang belum kedaluwarsa.
 */
export async function sajikanFotoLokal(req: Request, nama: string): Promise<Response> {
  if (env.NODE_ENV === "production" || env.FOTO_STORAGE !== "local") return tolak(404);
  const sesi = await sesiDariCookie();
  if (!sesi || sesi.mustChangePassword || sesi.role !== "super_admin") return tolak(403);

  const q = new URL(req.url).searchParams;
  if (!POLA_NAMA_FOTO.test(nama) || !urlLokalSah(env.BETTER_AUTH_SECRET, nama, Number(q.get("exp")), q.get("sig") ?? "")) {
    return tolak(403);
  }
  let isi: Uint8Array;
  try {
    isi = await fotoStorageLokal({ dir: env.FOTO_LOCAL_DIR, rahasia: env.BETTER_AUTH_SECRET }).baca(nama);
  } catch {
    return tolak(404);
  }
  return new Response(new Blob([new Uint8Array(isi)]), {
    headers: {
      "content-type": MIME[nama.split(".").pop() ?? ""] ?? "application/octet-stream",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
