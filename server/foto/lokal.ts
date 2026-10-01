import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FotoStorage } from "./storage";

/** Nama file foto lokal: acak dari server, tanpa direktori (mencegah path traversal). */
export const POLA_NAMA_FOTO = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;

function tandaTangan(rahasia: string, nama: string, exp: number): string {
  return createHmac("sha256", rahasia).update(`dev-foto:${nama}:${exp}`).digest("hex");
}

/** Tanda tangan URL dev cocok dan belum kedaluwarsa. */
export function urlLokalSah(rahasia: string, nama: string, exp: number, sig: string, sekarangMs = Date.now()): boolean {
  if (!Number.isSafeInteger(exp) || exp * 1000 < sekarangMs) return false;
  const harap = Buffer.from(tandaTangan(rahasia, nama, exp), "hex");
  const dapat = Buffer.from(sig, "hex");
  return harap.length === dapat.length && timingSafeEqual(harap, dapat);
}

/**
 * Disk lokal, HANYA untuk dev & tes (FOTO_STORAGE=local). URL bertanda tangan menunjuk ke
 * route dev app/api/dev-foto/[name] yang juga mewajibkan sesi super_admin.
 */
export function fotoStorageLokal(opsi: { dir: string; rahasia: string }): FotoStorage & {
  baca(nama: string): Promise<Uint8Array>;
} {
  const lokasi = (nama: string) => {
    if (!POLA_NAMA_FOTO.test(nama)) throw new Error("nama foto lokal tidak valid");
    return path.join(path.resolve(opsi.dir), nama);
  };
  return {
    async simpan(nama, data) {
      await mkdir(path.resolve(opsi.dir), { recursive: true });
      await writeFile(lokasi(nama), data, { flag: "wx" });
    },
    async hapus(nama) {
      await rm(lokasi(nama), { force: true });
    },
    async urlBertandatangan(nama, detik) {
      const exp = Math.floor(Date.now() / 1000) + detik;
      const sig = tandaTangan(opsi.rahasia, nama, exp);
      return { url: `/api/dev-foto/${nama}?exp=${exp}&sig=${sig}`, berlakuHingga: new Date(exp * 1000) };
    },
    async baca(nama) {
      return new Uint8Array(await readFile(lokasi(nama)));
    },
  };
}
