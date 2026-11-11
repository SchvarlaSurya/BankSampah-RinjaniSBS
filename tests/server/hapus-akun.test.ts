import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fail } from "@/contract";
import { buatPengguna, hapusPengguna, sesuaikanSaldo, simpanJenisSampah } from "@/server/api/actions";
import { listPengguna } from "@/server/api/queries";
import { postPresence } from "@/server/aktivitas-admin-route";
import { alasanTidakBisaDihapus, konfirmasiCocok } from "@/server/hapus-akun";
import { bukaKoneksi } from "../db/clients";
import { buatAkun, masuk, sbg, usernameAcak } from "./akun";

const { owner, app } = bukaKoneksi();

const ada = async (tabel: string, kolom: string, nilai: string) => {
  const [r] = await owner`select count(*)::int as n from ${owner(tabel)} where ${owner(kolom)} = ${nilai}`;
  return r.n as number;
};

const hapus = (userId: string, konfirmasi: string, alasan = "Salah input saat pendaftaran") =>
  hapusPengguna({ userId, konfirmasi, alasan });

async function detailDiDaftar(b: Awaited<ReturnType<typeof masuk>>, username: string) {
  const r = await sbg(b, () => listPengguna({ search: username }));
  if (!r.ok) throw new Error(r.code);
  return r.data.items.find((u) => u.username === username);
}

describe("hapusPengguna: otorisasi", () => {
  it("admin biasa dan nasabah ditolak (TIDAK_DIIZINKAN), tanpa sesi TIDAK_LOGIN", async () => {
    const target = await buatAkun("nasabah");
    const admin = await masuk(await buatAkun("admin"));
    const nasabah = await masuk(await buatAkun("nasabah"));
    expect(await sbg(admin, () => hapus(target.userId, target.username))).toEqual(fail("TIDAK_DIIZINKAN"));
    expect(await sbg(nasabah, () => hapus(target.userId, target.username))).toEqual(fail("TIDAK_DIIZINKAN"));
    expect(await ada("user", "id", target.userId)).toBe(1);
  });

  it("tidak bisa menghapus diri sendiri", async () => {
    const sa = await buatAkun("super_admin");
    const b = await masuk(sa);
    expect(await sbg(b, () => hapus(sa.userId, sa.username))).toEqual(fail("TIDAK_BISA_HAPUS_DIRI"));
    expect((await detailDiDaftar(b, sa.username))?.alasanTidakBisaDihapus).toBe("TIDAK_BISA_HAPUS_DIRI");
  });

  it("super_admin terakhir tidak bisa dihapus (aturan murni)", () => {
    const dasar = { id: "x", pelakuId: "y", punyaRiwayat: false };
    expect(alasanTidakBisaDihapus({ ...dasar, role: "super_admin", superAdminLain: 0 })).toBe("SUPER_ADMIN_TERAKHIR");
    expect(alasanTidakBisaDihapus({ ...dasar, role: "super_admin", superAdminLain: 1 })).toBeNull();
    expect(alasanTidakBisaDihapus({ ...dasar, role: "nasabah", superAdminLain: 0 })).toBeNull();
    expect(alasanTidakBisaDihapus({ ...dasar, role: "nasabah", superAdminLain: 1, punyaRiwayat: true })).toBe("AKUN_PUNYA_RIWAYAT");
  });
});

describe("hapusPengguna: konfirmasi & validasi", () => {
  it("konfirmasi harus ID atau nama persis; alasan wajib", async () => {
    const b = await masuk(await buatAkun("super_admin"));
    const t = await buatAkun("nasabah", { nama: "Warga Salah Input" });
    const salah = await sbg(b, () => hapus(t.userId, t.username.toUpperCase()));
    expect(salah).toMatchObject({ ok: false, code: "VALIDASI_GAGAL" });
    expect(salah.ok === false && salah.fieldErrors?.konfirmasi).toBeTruthy();
    const tanpaAlasan = await sbg(b, () => hapus(t.userId, t.username, "   "));
    expect(tanpaAlasan).toMatchObject({ ok: false, code: "VALIDASI_GAGAL" });
    expect(await ada("user", "id", t.userId)).toBe(1);

    // Nama lengkap persis juga diterima.
    expect((await sbg(b, () => hapus(t.userId, "Warga Salah Input"))).ok).toBe(true);
  });

  it("konfirmasiCocok: trim, peka huruf besar/kecil", () => {
    const t = { username: "0112", nama: "Ibu Sri" };
    expect(konfirmasiCocok(" 0112 ", t)).toBe(true);
    expect(konfirmasiCocok("Ibu Sri", t)).toBe(true);
    expect(konfirmasiCocok("ibu sri", t)).toBe(false);
    expect(konfirmasiCocok("", t)).toBe(false);
  });

  it("pengguna tidak ada -> PENGGUNA_TIDAK_DITEMUKAN", async () => {
    const b = await masuk(await buatAkun("super_admin"));
    expect(await sbg(b, () => hapus("tidak-ada", "x"))).toEqual(fail("PENGGUNA_TIDAK_DITEMUKAN"));
  });
});

describe("hapusPengguna: akun yang punya riwayat ditolak", () => {
  it("nasabah yang punya transaksi (saldo != 0) -> AKUN_PUNYA_RIWAYAT, tombol nonaktif", async () => {
    const sa = await buatAkun("super_admin");
    const bsa = await masuk(sa);
    const n = await buatAkun("nasabah");
    const r = await sbg(bsa, () =>
      sesuaikanSaldo({ customerId: n.userId, jumlah: 5000, alasan: "Saldo awal buku lama", clientRequestId: randomUUID() }),
    );
    expect(r.ok).toBe(true);
    expect(await sbg(bsa, () => hapus(n.userId, n.username))).toEqual(fail("AKUN_PUNYA_RIWAYAT"));
    expect(await detailDiDaftar(bsa, n.username)).toMatchObject({ bisaDihapus: false, alasanTidakBisaDihapus: "AKUN_PUNYA_RIWAYAT" });
    expect(await ada("user", "id", n.userId)).toBe(1);
  });

  it("staf yang tercatat sebagai petugas transaksi -> AKUN_PUNYA_RIWAYAT", async () => {
    const bsa = await masuk(await buatAkun("super_admin"));
    const petugas = await buatAkun("admin");
    const n = await buatAkun("nasabah");
    await sbg(await masuk(petugas), () =>
      sesuaikanSaldo({ customerId: n.userId, jumlah: 1000, alasan: "Saldo awal buku lama", clientRequestId: randomUUID() }),
    );
    expect(await sbg(bsa, () => hapus(petugas.userId, petugas.username))).toEqual(fail("AKUN_PUNYA_RIWAYAT"));
  });

  it("staf yang pernah mengubah harga -> AKUN_PUNYA_RIWAYAT", async () => {
    const bsa = await masuk(await buatAkun("super_admin"));
    const petugas = await buatAkun("admin");
    const js = await sbg(await masuk(petugas), () =>
      simpanJenisSampah({ nama: `Uji ${randomBytes(4).toString("hex")}`, hargaBeli: 1000, aktif: true }),
    );
    expect(js.ok).toBe(true);
    expect(await sbg(bsa, () => hapus(petugas.userId, petugas.username))).toEqual(fail("AKUN_PUNYA_RIWAYAT"));
  });

  it("super_admin yang pernah menghapus akun (tercatat di log audit) -> AKUN_PUNYA_RIWAYAT", async () => {
    const pelaku = await buatAkun("super_admin");
    const bp = await masuk(pelaku);
    const t = await buatAkun("nasabah");
    expect((await sbg(bp, () => hapus(t.userId, t.username))).ok).toBe(true);
    const lain = await masuk(await buatAkun("super_admin"));
    expect(await sbg(lain, () => hapus(pelaku.userId, pelaku.username))).toEqual(fail("AKUN_PUNYA_RIWAYAT"));
  });
});

describe("hapusPengguna: berhasil", () => {
  it("menghapus user + auth + aktivitas, mencatat log audit, ID bisa dipakai lagi", async () => {
    const sa = await buatAkun("super_admin");
    const bsa = await masuk(sa);
    const target = await buatAkun("admin", { nama: "Admin Dobel" });
    const bt = await masuk(target); // ada session, admin_login_day
    await sbg(bt, () =>
      postPresence(new Request("http://localhost:3000/api/admin/presence", { method: "POST", body: JSON.stringify({ status: "online" }) })),
    );
    expect(await ada("admin_presence", "user_id", target.userId)).toBe(1);
    expect(await detailDiDaftar(bsa, target.username)).toMatchObject({ bisaDihapus: true, alasanTidakBisaDihapus: null });

    const r = await sbg(bsa, () => hapus(target.userId, target.username, "  Akun dobel, salah tambah  "));
    expect(r).toEqual({ ok: true, data: { id: target.userId, username: target.username } });

    for (const [tabel, kolom] of [
      ["user", "id"],
      ["session", "user_id"],
      ["account", "user_id"],
      ["admin_login_day", "user_id"],
      ["admin_presence", "user_id"],
    ] as const) {
      expect(await ada(tabel, kolom, target.userId)).toBe(0);
    }

    const [log] = await owner`select * from public.audit_akun where target_user_id = ${target.userId}`;
    expect(log).toMatchObject({
      aksi: "hapus_akun",
      pelaku_id: sa.userId,
      target_username: target.username,
      target_nama: "Admin Dobel",
      target_role: "admin",
      alasan: "Akun dobel, salah tambah",
    });
    expect(log.waktu).toBeInstanceOf(Date);

    // Sesi akun terhapus tidak berlaku lagi.
    expect((await sbg(bt, () => listPengguna({}))).ok).toBe(false);

    // ID kosong lagi: boleh dipakai untuk akun baru.
    const baru = await sbg(bsa, () => buatPengguna({ role: "admin", username: target.username, nama: "Admin Pengganti" }));
    expect(baru.ok).toBe(true);
  });

  it("ID nasabah 4 digit yang dihapus bisa dipakai ulang", async () => {
    const bsa = await masuk(await buatAkun("super_admin"));
    let id = "";
    for (;;) {
      id = `9${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
      if ((await ada("user", "username", id)) === 0) break;
    }
    const n = await sbg(bsa, () => buatPengguna({ role: "nasabah", username: id, nama: "Warga Salah Ketik" }));
    if (!n.ok) throw new Error(n.code);
    expect((await sbg(bsa, () => hapus(n.data.pengguna.id, id))).ok).toBe(true);
    const lagi = await sbg(bsa, () => buatPengguna({ role: "nasabah", username: id, nama: "Warga Benar" }));
    expect(lagi.ok).toBe(true);
  });

  it("dua penghapusan bersamaan: satu berhasil, satu PENGGUNA_TIDAK_DITEMUKAN, satu log audit", async () => {
    const b1 = await masuk(await buatAkun("super_admin"));
    const b2 = await masuk(await buatAkun("super_admin"));
    const t = await buatAkun("nasabah", { username: usernameAcak("n") });
    const hasil = await Promise.all([sbg(b1, () => hapus(t.userId, t.username)), sbg(b2, () => hapus(t.userId, t.username))]);
    expect(hasil.filter((h) => h.ok)).toHaveLength(1);
    expect(hasil.filter((h) => !h.ok)).toEqual([fail("PENGGUNA_TIDAK_DITEMUKAN")]);
    expect(await ada("audit_akun", "target_user_id", t.userId)).toBe(1);
  });

  it("super_admin lain (tanpa riwayat) bisa dihapus selama masih ada super_admin aktif", async () => {
    const b = await masuk(await buatAkun("super_admin"));
    const sa2 = await buatAkun("super_admin");
    expect((await sbg(b, () => hapus(sa2.userId, sa2.username))).ok).toBe(true);
  });

  it("log audit append-only: app_server tidak bisa UPDATE/DELETE", async () => {
    await expect(app`update public.audit_akun set alasan = 'ubah'`).rejects.toThrow();
    await expect(app`delete from public.audit_akun`).rejects.toThrow();
  });
});
