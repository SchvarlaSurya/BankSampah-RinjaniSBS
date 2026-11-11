import "server-only";
import { randomUUID } from "node:crypto";
import { and, count, eq, gt, sql } from "drizzle-orm";
import sharp from "sharp";
import { type ActionResult, AVATAR, fail, FOTO_MIME, type FotoProfilResult, ok } from "@/contract";
import { db } from "../db";
import { user } from "../db/auth-schema";
import { fotoProfil, fotoProfilUnggah } from "../db/schema";
import { logServer } from "../errors";
import type { SesiServer } from "../guards";
import { fotoProfilStorage } from "./storage";
import { mimeDariIsi } from "./validasi";

/**
 * Batas piksel input sharp (cegah "bom dekompresi"). Sengaja di atas MAKS_DIMENSI² supaya gambar
 * yang sedikit kebesaran masih terbaca dan mendapat pesan dimensi yang jelas.
 */
const MAKS_PIKSEL_INPUT = 4096 * 4096;

export type HasilFotoProfil =
  | { ok: true; bytes: Uint8Array; namaAcak: string }
  | { ok: false; kode: "FOTO_WAJIB" | "FOTO_TIDAK_VALID" | "FOTO_TERLALU_BESAR"; pesan?: string };

/**
 * Validasi dari ukuran byte SEBENARNYA dan isi file (magic bytes + decode sharp), bukan ekstensi
 * atau Content-Type saja. Lolos = di-encode ulang ke WebP persegi AVATAR.TARGET_DIMENSI: metadata
 * (EXIF, lokasi GPS) dibuang, orientasi kamera diterapkan dulu.
 */
export async function periksaFotoProfil(foto: File | null): Promise<HasilFotoProfil> {
  if (!foto) return { ok: false, kode: "FOTO_WAJIB" };
  if (foto.size > AVATAR.MAKS_BYTES) return { ok: false, kode: "FOTO_TERLALU_BESAR" };
  const isi = new Uint8Array(await foto.arrayBuffer());
  if (isi.length === 0) return { ok: false, kode: "FOTO_WAJIB" };
  if (isi.length > AVATAR.MAKS_BYTES) return { ok: false, kode: "FOTO_TERLALU_BESAR" };

  const mime = mimeDariIsi(isi);
  if (mime === null) return { ok: false, kode: "FOTO_TIDAK_VALID" };
  // Tipe yang diklaim (bila ada) harus cocok dengan isi: "foto.jpg" berisi PNG / teks ditolak.
  if (foto.type && (!(FOTO_MIME as readonly string[]).includes(foto.type) || foto.type !== mime)) {
    return { ok: false, kode: "FOTO_TIDAK_VALID" };
  }

  try {
    const gambar = sharp(isi, { limitInputPixels: MAKS_PIKSEL_INPUT, failOn: "error" });
    const meta = await gambar.metadata();
    if (!meta.width || !meta.height) return { ok: false, kode: "FOTO_TIDAK_VALID" };
    if (meta.width > AVATAR.MAKS_DIMENSI || meta.height > AVATAR.MAKS_DIMENSI) {
      return {
        ok: false,
        kode: "FOTO_TIDAK_VALID",
        pesan: `Ukuran gambar maksimal ${AVATAR.MAKS_DIMENSI}×${AVATAR.MAKS_DIMENSI} piksel.`,
      };
    }
    const bytes = await gambar
      .rotate() // terapkan orientasi EXIF sebelum metadata dibuang
      .resize(AVATAR.TARGET_DIMENSI, AVATAR.TARGET_DIMENSI, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer(); // tanpa withMetadata(): EXIF/GPS/ICC tidak ikut
    return { ok: true, bytes: new Uint8Array(bytes), namaAcak: `${randomUUID()}.webp` };
  } catch {
    // Isi rusak / bukan gambar walau magic bytes cocok, atau piksel melebihi batas.
    return { ok: false, kode: "FOTO_TIDAK_VALID" };
  }
}

/** Pemilik foto boleh mengubah fotonya; super_admin boleh mengubah foto siapa pun (moderasi). */
export function bolehUbahFoto(sesi: Pick<SesiServer, "userId" | "role">, targetId: string): boolean {
  return targetId === sesi.userId || sesi.role === "super_admin";
}

/** Siapa boleh MELIHAT foto: pemiliknya, atau staf (admin/super_admin). Nasabah hanya fotonya sendiri. */
export function bolehLihatFoto(sesi: Pick<SesiServer, "userId" | "role" | "mustChangePassword">, targetId: string): boolean {
  if (targetId === sesi.userId) return true;
  return !sesi.mustChangePassword && (sesi.role === "admin" || sesi.role === "super_admin");
}

const hapusFile = (path: string, konteks: string) =>
  fotoProfilStorage()
    .hapus(path)
    .catch((e: unknown) => logServer(konteks, e));

/** Detik sampai slot unggah berikutnya terbuka, atau null bila masih boleh. */
async function sisaTungguUnggah(pengunggahId: string): Promise<number | null> {
  const [r] = await db
    .select({
      n: count(),
      tertua: sql<string | null>`min(${fotoProfilUnggah.waktu})::text`,
    })
    .from(fotoProfilUnggah)
    .where(and(eq(fotoProfilUnggah.userId, pengunggahId), gt(fotoProfilUnggah.waktu, sql`now() - interval '1 hour'`)));
  if (r.n < AVATAR.MAKS_UNGGAH_PER_JAM) return null;
  const tertua = r.tertua ? Date.parse(r.tertua) : Date.now();
  return Math.max(1, Math.ceil((tertua + 3_600_000 - Date.now()) / 1000));
}

export async function unggahFotoProfilUntuk(
  sesi: Pick<SesiServer, "userId" | "role">,
  targetId: string,
  foto: File | null,
): Promise<ActionResult<FotoProfilResult>> {
  if (!bolehUbahFoto(sesi, targetId)) return fail("TIDAK_DIIZINKAN");
  const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, targetId));
  if (!target) return fail("PENGGUNA_TIDAK_DITEMUKAN");

  const tunggu = await sisaTungguUnggah(sesi.userId);
  if (tunggu !== null) return fail("TERLALU_BANYAK_PERCOBAAN", { retryAfterDetik: tunggu });

  const f = await periksaFotoProfil(foto);
  if (!f.ok) return f.pesan ? fail(f.kode, { fieldErrors: { foto: [f.pesan] } }) : fail(f.kode);

  const storage = fotoProfilStorage();
  await storage.simpan(f.namaAcak, f.bytes, "image/webp");

  let hasil: { versi: Date; lama: string | null };
  try {
    hasil = await db.transaction(async (tx) => {
      const [sebelum] = await tx
        .select({ path: fotoProfil.path })
        .from(fotoProfil)
        .where(eq(fotoProfil.userId, targetId))
        .for("update");
      const [baris] = await tx
        .insert(fotoProfil)
        .values({ userId: targetId, path: f.namaAcak })
        .onConflictDoUpdate({ target: fotoProfil.userId, set: { path: f.namaAcak, diperbaruiAt: sql`now()` } })
        .returning({ diperbaruiAt: fotoProfil.diperbaruiAt });
      await tx.insert(fotoProfilUnggah).values({ userId: sesi.userId });
      return { versi: baris.diperbaruiAt, lama: sebelum?.path ?? null };
    });
  } catch (e) {
    await hapusFile(f.namaAcak, "unggahFotoProfil:hapus-baru");
    throw e;
  }
  // Foto lama dihapus setelah DB menunjuk ke foto baru.
  if (hasil.lama && hasil.lama !== f.namaAcak) await hapusFile(hasil.lama, "unggahFotoProfil:hapus-lama");
  return ok({ userId: targetId, fotoVersi: hasil.versi.toISOString() });
}

export async function hapusFotoProfilUntuk(
  sesi: Pick<SesiServer, "userId" | "role">,
  targetId: string,
): Promise<ActionResult<FotoProfilResult>> {
  if (!bolehUbahFoto(sesi, targetId)) return fail("TIDAK_DIIZINKAN");
  const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, targetId));
  if (!target) return fail("PENGGUNA_TIDAK_DITEMUKAN");
  const [dihapus] = await db.delete(fotoProfil).where(eq(fotoProfil.userId, targetId)).returning({ path: fotoProfil.path });
  if (dihapus) await hapusFile(dihapus.path, "hapusFotoProfil");
  return ok({ userId: targetId, fotoVersi: null });
}

/** Hapus file foto setelah akunnya terhapus (dipanggil sesudah commit). */
export async function hapusFileFotoProfil(path: string | null): Promise<void> {
  if (path) await hapusFile(path, "hapusAkun:hapus-foto");
}

/** Path foto untuk route penyaji. */
export async function pathFotoProfil(targetId: string): Promise<string | null> {
  const [r] = await db.select({ path: fotoProfil.path }).from(fotoProfil).where(eq(fotoProfil.userId, targetId));
  return r?.path ?? null;
}
