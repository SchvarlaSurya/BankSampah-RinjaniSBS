import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";

/** Byte gambar "asli" minimal (magic bytes benar) + ekor acak supaya hash selalu unik. */
export function bytesJpeg(ekor = 64): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...randomBytes(ekor)]);
}
export function bytesPng(ekor = 64): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...randomBytes(ekor)]);
}
export function bytesWebp(ekor = 64): Uint8Array {
  return Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), ...randomBytes(ekor)]);
}

export function fileFoto(bytes: Uint8Array, type = "image/jpeg", nama = "timbangan.jpg"): File {
  return new File([new Uint8Array(bytes)], nama, { type });
}

/** Isi FOTO_LOCAL_DIR (diset tests/server/setup.ts). */
export async function isiDirFoto(): Promise<string[]> {
  try {
    return (await readdir(process.env.FOTO_LOCAL_DIR!)).sort();
  } catch {
    return [];
  }
}
