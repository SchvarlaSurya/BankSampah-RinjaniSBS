import "server-only";
import type { FotoStorage } from "./storage";

/**
 * Supabase Storage lewat REST (tanpa supabase-js), memakai service_role key DI SERVER SAJA.
 * Endpoint mengikuti storage-js resmi: upload POST /object/{bucket}/{path} (x-upsert: false),
 * signed URL POST /object/sign/{bucket}/{path} {expiresIn} -> {signedURL},
 * hapus DELETE /object/{bucket} {prefixes}, unduh GET /object/authenticated/{bucket}/{path}.
 *
 * BELUM TERUJI terhadap Supabase asli. Bucket harus PRIVATE.
 */
export function fotoStorageSupabase(opsi: { url: string; kunci: string; bucket: string }): FotoStorage {
  const dasar = `${opsi.url.replace(/\/+$/, "")}/storage/v1`;
  const header = { Authorization: `Bearer ${opsi.kunci}`, apikey: opsi.kunci };
  const objek = (p: string) => `${encodeURIComponent(opsi.bucket)}/${p.split("/").map(encodeURIComponent).join("/")}`;

  async function pastikan(res: Response, aksi: string) {
    // Isi respons tidak ikut dilempar: bisa memuat path; status cukup untuk log server.
    if (!res.ok) throw new Error(`Supabase Storage ${aksi} gagal: HTTP ${res.status}`);
  }

  return {
    async simpan(p, data, mime) {
      const res = await fetch(`${dasar}/object/${objek(p)}`, {
        method: "POST",
        headers: { ...header, "content-type": mime, "x-upsert": "false", "cache-control": "max-age=3600" },
        body: new Blob([new Uint8Array(data)], { type: mime }),
      });
      await pastikan(res, "upload");
    },
    async hapus(p) {
      const res = await fetch(`${dasar}/object/${encodeURIComponent(opsi.bucket)}`, {
        method: "DELETE",
        headers: { ...header, "content-type": "application/json" },
        body: JSON.stringify({ prefixes: [p] }),
      });
      await pastikan(res, "hapus");
    },
    async urlBertandatangan(p, detik) {
      const res = await fetch(`${dasar}/object/sign/${objek(p)}`, {
        method: "POST",
        headers: { ...header, "content-type": "application/json" },
        body: JSON.stringify({ expiresIn: detik }),
      });
      await pastikan(res, "sign");
      const { signedURL } = (await res.json()) as { signedURL: string };
      return { url: `${dasar}${signedURL}`, berlakuHingga: new Date(Date.now() + detik * 1000) };
    },
    async baca(p) {
      const res = await fetch(`${dasar}/object/authenticated/${objek(p)}`, { headers: header });
      await pastikan(res, "unduh");
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}
