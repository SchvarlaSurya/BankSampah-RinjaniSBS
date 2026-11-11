import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AVATAR, buildFotoProfilFormData, fail } from "@/contract";
import { hapusFotoProfil, hapusPengguna, unggahFotoProfil } from "@/server/api/actions";
import { getSesi, listPengguna } from "@/server/api/queries";
import { sajikanFotoProfil } from "@/server/foto/profil-route";
import { bukaKoneksi } from "../db/clients";
import { buatAkun, masuk, sbg } from "./akun";
import { Browser } from "./next-headers-mock";

const { owner } = bukaKoneksi();
const dirProfil = () => path.join(process.env.FOTO_LOCAL_DIR!, "profil");

async function gambar(lebar: number, tinggi: number, format: "png" | "jpeg" | "webp" = "png", opsi: { exif?: boolean } = {}) {
  let g = sharp({ create: { width: lebar, height: tinggi, channels: 3, background: { r: 40, g: 160, b: 90 } } });
  if (opsi.exif) g = g.withExif({ IFD0: { Copyright: "RAHASIA-EXIF", Artist: "Lokasi Rumah" } });
  return new Uint8Array(await g.toFormat(format).toBuffer());
}

const file = (isi: Uint8Array, type: string, nama = "foto") => new File([new Uint8Array(isi)], nama, { type });
const unggah = (f: File, userId?: string) => unggahFotoProfil(buildFotoProfilFormData(f, userId));

async function pathFoto(userId: string): Promise<string | null> {
  const [r] = await owner`select path from public.foto_profil where user_id = ${userId}`;
  return r?.path ?? null;
}
const adaFile = async (nama: string) => (await readdir(dirProfil()).catch(() => [] as string[])).includes(nama);

describe("unggahFotoProfil: validasi", () => {
  it("foto valid (PNG/JPEG/WebP): disimpan sebagai WebP 512px tanpa EXIF, versi masuk sesi", async () => {
    const n = await buatAkun("nasabah");
    const b = await masuk(n);
    const r = await sbg(b, async () => unggah(file(await gambar(800, 600, "jpeg", { exif: true }), "image/jpeg")));
    if (!r.ok) throw new Error(r.code);
    expect(r.data.userId).toBe(n.userId);
    expect(r.data.fotoVersi).toMatch(/Z$/);

    const p = await pathFoto(n.userId);
    expect(p).toMatch(/^[a-f0-9-]{36}\.webp$/);
    const res = await sbg(b, () => sajikanFotoProfil(n.userId));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    const isi = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(isi).metadata();
    expect(meta).toMatchObject({ format: "webp", width: AVATAR.TARGET_DIMENSI, height: AVATAR.TARGET_DIMENSI });
    expect(meta.exif).toBeUndefined();
    expect(isi.includes("RAHASIA-EXIF")).toBe(false);

    expect((await sbg(b, () => getSesi()))?.fotoVersi).toBe(r.data.fotoVersi);
    for (const f of ["png", "webp"] as const) {
      expect((await sbg(b, async () => unggah(file(await gambar(300, 300, f), `image/${f}`)))).ok).toBe(true);
    }
  });

  it("lebih dari batas KB (ukuran byte sebenarnya) -> FOTO_TERLALU_BESAR", async () => {
    const b = await masuk(await buatAkun("nasabah"));
    const besar = new Uint8Array(AVATAR.MAKS_BYTES + 1);
    besar.set([0xff, 0xd8, 0xff]);
    expect(await sbg(b, () => unggah(file(besar, "image/jpeg")))).toEqual(fail("FOTO_TERLALU_BESAR"));
  });

  it("tipe palsu ditolak: teks bernama .jpg, PNG diklaim JPEG, magic JPEG tapi isi rusak, GIF", async () => {
    const b = await masuk(await buatAkun("nasabah"));
    const teks = new TextEncoder().encode("ini bukan gambar <script>alert(1)</script>");
    expect(await sbg(b, () => unggah(file(teks, "image/jpeg", "foto.jpg")))).toEqual(fail("FOTO_TIDAK_VALID"));
    expect(await sbg(b, async () => unggah(file(await gambar(100, 100, "png"), "image/jpeg")))).toEqual(fail("FOTO_TIDAK_VALID"));
    const rusak = new Uint8Array(2000);
    rusak.set([0xff, 0xd8, 0xff, 0xe0]);
    expect(await sbg(b, () => unggah(file(rusak, "image/jpeg")))).toEqual(fail("FOTO_TIDAK_VALID"));
    const gif = new TextEncoder().encode("GIF89a\x01\x00\x01\x00");
    expect(await sbg(b, () => unggah(file(gif, "image/gif")))).toEqual(fail("FOTO_TIDAK_VALID"));
  });

  it("dimensi > 1024px -> FOTO_TIDAK_VALID dengan pesan jelas; tanpa file -> FOTO_WAJIB", async () => {
    const b = await masuk(await buatAkun("nasabah"));
    const r = await sbg(b, async () => unggah(file(await gambar(1100, 400, "jpeg"), "image/jpeg")));
    expect(r).toMatchObject({ ok: false, code: "FOTO_TIDAK_VALID" });
    expect(r.ok === false && r.fieldErrors?.foto?.[0]).toContain("1024");
    expect(await sbg(b, () => unggahFotoProfil(new FormData()))).toEqual(fail("FOTO_WAJIB"));
  });

  it(`maks ${AVATAR.MAKS_UNGGAH_PER_JAM} unggahan per jam per akun`, async () => {
    const b = await masuk(await buatAkun("admin"));
    const png = await gambar(64, 64);
    for (let i = 0; i < AVATAR.MAKS_UNGGAH_PER_JAM; i++) {
      expect((await sbg(b, () => unggah(file(png, "image/png")))).ok).toBe(true);
    }
    const r = await sbg(b, () => unggah(file(png, "image/png")));
    expect(r).toMatchObject({ ok: false, code: "TERLALU_BANYAK_PERCOBAAN" });
    expect(r.ok === false && r.retryAfterDetik).toBeGreaterThan(0);
  });
});

describe("foto profil: hak ubah & lihat", () => {
  it("nasabah & admin tidak bisa mengubah/menghapus foto orang lain; super_admin bisa (moderasi)", async () => {
    const target = await buatAkun("nasabah");
    const png = await gambar(64, 64);
    for (const role of ["nasabah", "admin"] as const) {
      const b = await masuk(await buatAkun(role));
      expect(await sbg(b, () => unggah(file(png, "image/png"), target.userId))).toEqual(fail("TIDAK_DIIZINKAN"));
      expect(await sbg(b, () => hapusFotoProfil({ userId: target.userId }))).toEqual(fail("TIDAK_DIIZINKAN"));
    }
    const sa = await masuk(await buatAkun("super_admin"));
    expect((await sbg(sa, () => unggah(file(png, "image/png"), target.userId))).ok).toBe(true);
    expect(await pathFoto(target.userId)).not.toBeNull();
    expect((await sbg(sa, () => hapusFotoProfil({ userId: target.userId }))).ok).toBe(true);
    expect(await pathFoto(target.userId)).toBeNull();
  });

  it("route foto: tanpa sesi 401; nasabah lain 404; admin & pemilik 200; daftar pengguna membawa versi", async () => {
    const n = await buatAkun("nasabah");
    const bn = await masuk(n);
    expect((await sbg(bn, async () => unggah(file(await gambar(64, 64), "image/png")))).ok).toBe(true);

    expect((await sbg(new Browser(), () => sajikanFotoProfil(n.userId))).status).toBe(401);
    const lain = await masuk(await buatAkun("nasabah"));
    expect((await sbg(lain, () => sajikanFotoProfil(n.userId))).status).toBe(404);
    const admin = await masuk(await buatAkun("admin"));
    expect((await sbg(admin, () => sajikanFotoProfil(n.userId))).status).toBe(200);
    expect((await sbg(bn, () => sajikanFotoProfil(n.userId))).status).toBe(200);
    // Pemilik tanpa foto: 404 (UI menampilkan inisial).
    expect((await sbg(lain, () => sajikanFotoProfil("tidak-ada"))).status).toBe(404);

    const daftar = await sbg(admin, () => listPengguna({ search: n.username }));
    if (!daftar.ok) throw new Error(daftar.code);
    expect(daftar.data.items[0].fotoVersi).toMatch(/Z$/);
  });
});

describe("foto profil: file lama dibersihkan", () => {
  it("ganti foto menghapus file lama; Hapus foto menghapus baris + file", async () => {
    const b = await masuk(await buatAkun("nasabah"));
    const u = (await sbg(b, () => getSesi()))!;
    await sbg(b, async () => unggah(file(await gambar(64, 64), "image/png")));
    const lama = (await pathFoto(u.userId))!;
    expect(await adaFile(lama)).toBe(true);
    await sbg(b, async () => unggah(file(await gambar(80, 80), "image/png")));
    const baru = (await pathFoto(u.userId))!;
    expect(baru).not.toBe(lama);
    expect(await adaFile(lama)).toBe(false);
    expect(await adaFile(baru)).toBe(true);

    expect(await sbg(b, () => hapusFotoProfil())).toEqual({ ok: true, data: { userId: u.userId, fotoVersi: null } });
    expect(await pathFoto(u.userId)).toBeNull();
    expect(await adaFile(baru)).toBe(false);
  });

  it("hapus akun ikut menghapus foto profil (baris + file)", async () => {
    const n = await buatAkun("nasabah");
    const bn = await masuk(n);
    await sbg(bn, async () => unggah(file(await gambar(64, 64), "image/png")));
    const p = (await pathFoto(n.userId))!;
    const sa = await masuk(await buatAkun("super_admin"));
    expect((await sbg(sa, () => hapusPengguna({ userId: n.userId, konfirmasi: n.username, alasan: "Akun dobel" }))).ok).toBe(true);
    expect(await pathFoto(n.userId)).toBeNull();
    expect(await adaFile(p)).toBe(false);
  });
});
