import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Menyimpan file foto timbangan ke folder public/uploads/
 * dan menghitung SHA-256 hash-nya (format: sha256-<hex>).
 */
export async function simpanFoto(file: File): Promise<{ pathFoto: string; hashFoto: string }> {
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
