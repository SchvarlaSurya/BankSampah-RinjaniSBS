import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { FOTO_MIME, LIMIT } from "@/src/contract";

/**
 * Menyimpan file foto timbangan ke folder public/uploads/
 * dan menghitung SHA-256 hash-nya (format: sha256-<hex>).
 */
export async function simpanFoto(file: File): Promise<{ pathFoto: string; hashFoto: string }> {
  if (!FOTO_MIME.includes(file.type as any)) {
    throw new Error("FOTO_TIDAK_VALID");
  }

  if (file.size > LIMIT.FOTO_MAKS_BYTES) {
    throw new Error("FOTO_TERLALU_BESAR");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const hashHex = crypto.createHash("sha256").update(buffer).digest("hex");
  const hashFoto = `sha256-${hashHex}`;

  let ext = ".jpg";
  if (file.type === "image/png") ext = ".png";
  if (file.type === "image/webp") ext = ".webp";

  const filename = `${hashHex}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  await fs.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, buffer);

  const pathFoto = `/uploads/${filename}`;
  return { pathFoto, hashFoto };
}

/**
 * Menghapus file foto dari disk bila transaksi DB gagal
 */
export async function hapusFoto(pathFoto: string): Promise<void> {
  try {
    const filename = path.basename(pathFoto);
    const filePath = path.join(process.cwd(), "public", "uploads", filename);
    await fs.unlink(filePath);
  } catch (err) {
    // Abaikan jika file memang tidak ada
    console.error("Gagal membersihkan file foto:", pathFoto, err);
  }
}

