import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { FOTO_MIME, LIMIT } from "@/contract";

type MimeFoto = (typeof FOTO_MIME)[number];

const EKSTENSI: Record<MimeFoto, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Jenis dari isi file (magic bytes), bukan dari nama/Content-Type kiriman klien. */
export function mimeDariIsi(b: Uint8Array): MimeFoto | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 8 && png.every((x, i) => b[i] === x)) return "image/png";
  const ascii = (dari: number, sampai: number) => String.fromCharCode(...b.subarray(dari, sampai));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export type HasilFoto =
  | { ok: true; bytes: Uint8Array; mime: MimeFoto; sha256: string; namaAcak: string }
  | { ok: false; kode: "FOTO_WAJIB" | "FOTO_TIDAK_VALID" };

export async function periksaFoto(foto: File | null): Promise<HasilFoto> {
  if (!foto) return { ok: false, kode: "FOTO_WAJIB" };
  if (!(FOTO_MIME as readonly string[]).includes(foto.type)) return { ok: false, kode: "FOTO_TIDAK_VALID" };
  if (foto.size > LIMIT.FOTO_MAKS_BYTES) return { ok: false, kode: "FOTO_TIDAK_VALID" };
  const bytes = new Uint8Array(await foto.arrayBuffer());
  if (bytes.length === 0 || bytes.length > LIMIT.FOTO_MAKS_BYTES) return { ok: false, kode: "FOTO_TIDAK_VALID" };
  // Isi harus benar-benar gambar dan sesuai jenis yang diklaim.
  const mime = mimeDariIsi(bytes);
  if (mime === null || mime !== foto.type) return { ok: false, kode: "FOTO_TIDAK_VALID" };
  return {
    ok: true,
    bytes,
    mime,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    namaAcak: `${randomUUID()}.${EKSTENSI[mime]}`,
  };
}
