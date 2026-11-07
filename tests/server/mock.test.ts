import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSetorFormData, fail } from "@/contract";
import { store } from "@/lib/api/mock/_store";
import { mockActions as a } from "@/lib/api/mock/actions";
import { mockQueries as q } from "@/lib/api/mock/queries";
import { bytesJpeg, bytesPng, fileFoto } from "./foto";

// Mock harus berperilaku seperti backend (kode error & aturan yang sama), supaya frontend yang
// dikembangkan dengan mock tidak kaget saat saklar dibalik ke implementasi asli.

const masukSebagai = async (username: string) => {
  const h = await a.login({ username, password: "password123" });
  if (!h.ok) throw new Error(h.code);
};

const SA = "superadmin";
const ADMIN = "admin01";
const BUDI = "0101"; // user-nasabah-1, saldo awal 50.000

beforeEach(() => {
  store.sesi = null;
  for (const u of [...store.staf, ...store.nasabah]) {
    u.aktif = true;
    store.mustChangePassword.set(u.id, false);
  }
});

describe("mock = backend", () => {
  it("login nonaktif -> KREDENSIAL_SALAH; nonaktif saat masih login -> TIDAK_LOGIN; logout tanpa sesi -> TIDAK_LOGIN", async () => {
    store.nasabah[0].aktif = false;
    expect(await a.login({ username: BUDI, password: "password123" })).toEqual(fail("KREDENSIAL_SALAH"));
    store.nasabah[0].aktif = true;
    await masukSebagai(BUDI);
    store.nasabah[0].aktif = false;
    expect(await q.getProfilSaya()).toEqual(fail("TIDAK_LOGIN"));
    expect(await q.getSesi()).toBeNull();
    expect(await a.logout()).toEqual(fail("TIDAK_LOGIN"));
  });

  it("WAJIB_GANTI_PASSWORD kecuali getSesi/gantiPassword; AKSES sama dengan kontrak", async () => {
    store.mustChangePassword.set("user-admin-1", true);
    await masukSebagai(ADMIN);
    expect(await q.cariNasabah({ query: "01" })).toEqual(fail("WAJIB_GANTI_PASSWORD"));
    expect((await q.getSesi())?.mustChangePassword).toBe(true);
    store.mustChangePassword.set("user-admin-1", false);
    store.sesi = { ...store.sesi!, mustChangePassword: false };
    expect(await q.listStaf()).toEqual(fail("TIDAK_DIIZINKAN"));
    await masukSebagai(BUDI);
    expect(await q.getNasabah({ customerId: "user-nasabah-1" })).toEqual(fail("TIDAK_DIIZINKAN"));
  });

  it("validasi input query & aturan nasabah", async () => {
    await masukSebagai(ADMIN);
    const pendek = await q.cariNasabah({ query: "a" });
    expect(!pendek.ok && pendek.code).toBe("VALIDASI_GAGAL");
    const salahId = await q.getTransaksi({ id: "abc" });
    expect(!salahId.ok && salahId.code).toBe("VALIDASI_GAGAL");
    expect(await q.getHistori({ customerId: "user-admin-1" })).toEqual(fail("NASABAH_TIDAK_DITEMUKAN"));

    await masukSebagai(SA);
    expect(await q.auditTransaksi({ dari: "2026-02-30" })).toEqual(
      fail("VALIDASI_GAGAL", { fieldErrors: { dari: ["Tanggal tidak valid"] } }),
    );

    await masukSebagai(BUDI);
    const h = await q.getHistori({ customerId: "user-nasabah-2" });
    expect(h.ok && h.data.items.every((t) => t.id !== "1003")).toBe(true); // dipaksa ke diri sendiri
    expect(await q.getTransaksi({ id: "1003" })).toEqual(fail("TRANSAKSI_TIDAK_DITEMUKAN")); // milik Siti
  });

  it("setor: payload dulu, lalu foto wajib, isi foto dicek, foto tidak boleh dipakai dua kali", async () => {
    await masukSebagai(ADMIN);
    const input = { customerId: "user-nasabah-1", items: [{ wasteTypeId: "1", berat: "2" }], clientRequestId: randomUUID() };
    const fd = new FormData();
    fd.append("payload", JSON.stringify({ ...input, items: [] }));
    const tanpaItem = await a.setor(fd);
    expect(!tanpaItem.ok && tanpaItem.code).toBe("VALIDASI_GAGAL");
    const tanpaFoto = new FormData();
    tanpaFoto.append("payload", JSON.stringify(input));
    expect(await a.setor(tanpaFoto)).toEqual(fail("FOTO_WAJIB"));
    expect(await a.setor(buildSetorFormData(input, fileFoto(bytesPng(), "image/jpeg")))).toEqual(fail("FOTO_TIDAK_VALID"));

    const foto = bytesJpeg();
    const ok1 = await a.setor(buildSetorFormData(input, fileFoto(foto)));
    expect(ok1.ok).toBe(true);
    const lagi = await a.setor(buildSetorFormData({ ...input, clientRequestId: randomUUID() }, fileFoto(foto)));
    expect(lagi).toEqual(fail("FOTO_SUDAH_DIPAKAI"));
  });

  it("tarik nasabah nonaktif boleh; UUID dipakai untuk operasi lain -> VALIDASI_GAGAL", async () => {
    await masukSebagai(ADMIN);
    store.nasabah[1].aktif = false;
    const uuid = randomUUID();
    const t = await a.tarik({ customerId: "user-nasabah-2", jumlah: 1000, clientRequestId: uuid });
    expect(t.ok).toBe(true);
    const lain = await a.sesuaikanSaldo({ customerId: "user-nasabah-2", jumlah: 5, alasan: "alasan cukup", clientRequestId: uuid });
    expect(!lain.ok && lain.code).toBe("VALIDASI_GAGAL");
  });

  it("setStatusPengguna: hanya menonaktifkan diri sendiri yang ditolak; nama jenis sampah dobel ditolak", async () => {
    await masukSebagai(SA);
    expect((await a.setStatusPengguna({ userId: "user-sa-1", aktif: true })).ok).toBe(true);
    expect(await a.setStatusPengguna({ userId: "user-sa-1", aktif: false })).toEqual(fail("TIDAK_BISA_NONAKTIFKAN_DIRI"));
    expect(await a.simpanJenisSampah({ nama: "  KARDUS ", hargaBeli: 1000, aktif: true })).toEqual(
      fail("VALIDASI_GAGAL", { fieldErrors: { nama: ["Nama jenis sampah sudah dipakai"] } }),
    );
  });
});
