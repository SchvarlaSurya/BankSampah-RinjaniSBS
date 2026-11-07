import { describe, expect, it } from "vitest";
import { BuatPenggunaInputSchema, fail, KATA_TERLARANG, mengandungKataTerlarang, PESAN_NAMA_TERLARANG } from "@/contract";
import { buatPengguna } from "@/server/api/actions";
import { buatAkun, masuk, sbg, usernameAcak } from "./akun";

const nama = BuatPenggunaInputSchema.shape.nama;
const pesan = (v: string) => {
  const h = nama.safeParse(v);
  return h.success ? null : h.error.issues.map((i) => i.message);
};

describe("aturan nama pengguna (kontrak)", () => {
  it("semua kata di daftar ditolak, tidak peka huruf besar, sebagai kata utuh di mana pun", () => {
    for (const k of KATA_TERLARANG) {
      expect(mengandungKataTerlarang(k), k).toBe(true);
      expect(mengandungKataTerlarang(`Budi ${k.toUpperCase()}`), k).toBe(true);
      expect(mengandungKataTerlarang(`${k}.Santoso`), k).toBe(true);
    }
  });

  it("variasi leet-speak, huruf berulang, dan huruf dipisah ditolak", () => {
    for (const v of ["@njing", "4njing", "b4ngs4t", "g0bl0k", "$hit", "5hit", "b!tch", "b1tch", "f u c k", "a.n.j.i.n.g", "anjiiing", "SEXXX", "t0l0l"]) {
      expect(mengandungKataTerlarang(v), v).toBe(true);
    }
  });

  it("nama asli yang memuat potongan kata mirip TIDAK ditolak", () => {
    for (const v of ["Dickson Siregar", "Hasudungan", "Bobby", "Bonar", "Essex Putra", "Rosa Pukiah", "Siti Aminah", "M. Rizki", "Jum'at Hidayat", "Pantekosta"]) {
      expect(mengandungKataTerlarang(v), v).toBe(false);
      expect(pesan(v), v).toBeNull();
    }
  });

  it("panjang 3-40, karakter terbatas, pesan kata terlarang persis", () => {
    expect(pesan("Al")).toEqual(["Minimal 3 karakter"]);
    expect(pesan("A".repeat(41))).toEqual(["Maksimal 40 karakter"]);
    expect(pesan("  Ali  ")).toBeNull();
    expect(pesan("Budi_Santoso")).toEqual(["Hanya boleh huruf, angka, spasi, titik (.), dan petik tunggal (')"]);
    expect(pesan("Budi <script>")).not.toBeNull();
    expect(pesan("Budi Anjing")).toEqual([PESAN_NAMA_TERLARANG]);
    expect(pesan("Budi @njing")).toContain(PESAN_NAMA_TERLARANG);
  });

  it("buatPengguna menolak nama terlarang dengan fieldErrors.nama", async () => {
    const sa = await masuk(await buatAkun("super_admin"));
    expect(await sbg(sa, () => buatPengguna({ role: "nasabah", username: usernameAcak(), nama: "Si Goblok" }))).toEqual(
      fail("VALIDASI_GAGAL", { fieldErrors: { nama: [PESAN_NAMA_TERLARANG] } }),
    );
  });
});
