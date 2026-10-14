import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fail } from "@/contract";
import { simpanJenisSampah, updateHargaSampah } from "@/server/api/actions";
import {
  cariNasabah,
  getNasabah,
  getProfilSaya,
  getSesi,
  listJenisSampah,
  listRiwayatHarga,
  listStaf,
} from "@/server/api/queries";
import { bukaKoneksi } from "../db/clients";
import { buatJenis } from "../db/factories";
import { beratUntukRupiah, itemsJson, setor } from "../db/ledger";
import { buatAkun, masuk, sbg } from "./akun";
import { Browser } from "./next-headers-mock";

const { owner, app } = bukaKoneksi();

async function isiSaldoAkun(customerId: string, rupiah: number) {
  const admin = await buatAkun("admin");
  const jenis = await buatJenis(owner, 100);
  await setor(app, { customerId, adminId: admin.userId, items: itemsJson([{ wasteTypeId: jenis, berat: beratUntukRupiah(rupiah) }]) });
}

describe("getSesi", () => {
  it("null bila anonim / akun nonaktif; SesiInfo dari DB bila login (termasuk mustChangePassword)", async () => {
    expect(await sbg(new Browser(), () => getSesi())).toBeNull();
    const a = await buatAkun("admin", { mustChangePassword: true });
    const b = await masuk(a);
    expect(await sbg(b, () => getSesi())).toEqual({
      userId: a.userId,
      username: a.username,
      nama: "Tes admin",
      role: "admin",
      mustChangePassword: true,
    });
    await owner`update public."user" set aktif = false where id = ${a.userId}`;
    expect(await sbg(b, () => getSesi())).toBeNull();
  });
});

describe("getProfilSaya (nasabah)", () => {
  it("profil & saldo milik sendiri; admin -> TIDAK_DIIZINKAN", async () => {
    const a = await buatAkun("nasabah");
    await isiSaldoAkun(a.userId, 12_345);
    const b = await masuk(a);
    expect(await sbg(b, () => getProfilSaya())).toEqual({
      ok: true,
      data: { id: a.userId, username: a.username, nama: "Tes nasabah", aktif: true, saldo: 12_345 },
    });
    const admin = await masuk(await buatAkun("admin"));
    expect(await sbg(admin, () => getProfilSaya())).toEqual(fail("TIDAK_DIIZINKAN"));
  });

  it("nasabah A tidak bisa membaca data nasabah B", async () => {
    const a = await buatAkun("nasabah");
    const bAkun = await buatAkun("nasabah");
    await isiSaldoAkun(bAkun.userId, 999);
    const sesiA = await masuk(a);
    expect(await sbg(sesiA, () => getNasabah({ customerId: bAkun.userId }))).toEqual(fail("TIDAK_DIIZINKAN"));
    expect(await sbg(sesiA, () => cariNasabah({ query: bAkun.username }))).toEqual(fail("TIDAK_DIIZINKAN"));
    const profil = await sbg(sesiA, () => getProfilSaya());
    expect(profil.ok && profil.data).toMatchObject({ id: a.userId, saldo: 0 });
  });
});

describe("cariNasabah (admin, super_admin)", () => {
  it("prefix username atau nama, tidak peka huruf besar, hanya nasabah, maks 20", async () => {
    const tag = `q${randomBytes(4).toString("hex")}`;
    const ids: string[] = [];
    for (let i = 0; i < 22; i++) {
      const id = `${tag}_${i}`;
      ids.push(id);
      await owner`
        insert into public."user" (id, name, email, username, role)
        values (${id}, ${`Warga ${i}`}, ${`${id}@test.local`}, ${`${tag}${String(i).padStart(2, "0")}`}, 'nasabah')`;
    }
    await owner`
      insert into public."user" (id, name, email, username, role)
      values (${`${tag}_adm`}, 'Admin', ${`${tag}_adm@test.local`}, ${`${tag}adm`}, 'admin'),
             (${`${tag}_nm`}, ${`${tag.toUpperCase()} Nama Depan`}, ${`${tag}_nm@test.local`}, ${`zz${tag}`}, 'nasabah')`;

    const admin = await masuk(await buatAkun("admin"));
    const hasil = await sbg(admin, () => cariNasabah({ query: tag.toUpperCase() }));
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.data).toHaveLength(20);
    expect(hasil.data.every((n) => n.username.startsWith(tag) || n.nama.toLowerCase().startsWith(tag))).toBe(true);
    expect(hasil.data.some((n) => n.username === `${tag}adm`)).toBe(false);
    expect(hasil.data[0]).toEqual({ id: `${tag}_0`, username: `${tag}00`, nama: "Warga 0", aktif: true, saldo: 0 });

    const lewatNama = await sbg(admin, () => cariNasabah({ query: `${tag} nama` }));
    expect(lewatNama.ok && lewatNama.data.map((n) => n.username)).toEqual([`zz${tag}`]);
  });

  it("% dan _ di input di-escape (tidak menjadi wildcard)", async () => {
    const tag = `w${randomBytes(4).toString("hex")}`;
    await owner`
      insert into public."user" (id, name, email, username, role) values
        (${`${tag}_a`}, 'A', ${`${tag}_a@test.local`}, ${`${tag}abc`}, 'nasabah'),
        (${`${tag}_b`}, 'B', ${`${tag}_b@test.local`}, ${`${tag}_bc`}, 'nasabah'),
        (${`${tag}_c`}, 'C', ${`${tag}_c@test.local`}, ${`${tag}%bc`}, 'nasabah')`;
    const sa = await masuk(await buatAkun("super_admin"));
    const cari = async (q: string) => {
      const h = await sbg(sa, () => cariNasabah({ query: q }));
      return h.ok ? h.data.map((n) => n.username).sort() : h.code;
    };
    expect(await cari(`${tag}_`)).toEqual([`${tag}_bc`]);
    expect(await cari(`${tag}%`)).toEqual([`${tag}%bc`]);
    expect(await cari(tag)).toEqual([`${tag}%bc`, `${tag}_bc`, `${tag}abc`].sort());
    expect(await cari("%%")).toEqual([]);
    const pendek = await sbg(sa, () => cariNasabah({ query: "a" }));
    expect(!pendek.ok && pendek.code).toBe("VALIDASI_GAGAL");
  });
});

describe("getNasabah (admin, super_admin)", () => {
  it("data + saldo; bukan nasabah / tidak ada -> NASABAH_TIDAK_DITEMUKAN", async () => {
    const n = await buatAkun("nasabah");
    await isiSaldoAkun(n.userId, 7_000);
    await owner`update public."user" set aktif = false where id = ${n.userId}`;
    const admin = await buatAkun("admin");
    const b = await masuk(admin);
    expect(await sbg(b, () => getNasabah({ customerId: n.userId }))).toEqual({
      ok: true,
      data: { id: n.userId, username: n.username, nama: "Tes nasabah", aktif: false, saldo: 7_000 },
    });
    expect(await sbg(b, () => getNasabah({ customerId: admin.userId }))).toEqual(fail("NASABAH_TIDAK_DITEMUKAN"));
    expect(await sbg(b, () => getNasabah({ customerId: "tidak-ada" }))).toEqual(fail("NASABAH_TIDAK_DITEMUKAN"));
  });
});

describe("simpanJenisSampah & listJenisSampah", () => {
  it("buat, ubah, nama duplikat (abaikan besar-kecil & spasi) -> VALIDASI_GAGAL fieldErrors.nama", async () => {
    const sa = await masuk(await buatAkun("super_admin"));
    const nama = `Botol ${randomBytes(3).toString("hex")}`;
    const buat = await sbg(sa, () => simpanJenisSampah({ nama: `  ${nama} `, hargaBeli: 2500, aktif: true }));
    expect(buat).toEqual({
      ok: true,
      data: { id: expect.stringMatching(/^\d+$/), nama, hargaBeli: 2500, hargaJual: null, aktif: true },
    });
    if (!buat.ok) return;

    const ubah = await sbg(sa, () => simpanJenisSampah({ id: buat.data.id, nama, hargaBeli: 3000, hargaJual: 3600, aktif: false }));
    expect(ubah).toEqual({ ok: true, data: { id: buat.data.id, nama, hargaBeli: 3000, hargaJual: 3600, aktif: false } });
    // hargaJual tidak dikirim = tidak diubah.
    const tetap = await sbg(sa, () => simpanJenisSampah({ id: buat.data.id, nama, hargaBeli: 3000, aktif: false }));
    expect(tetap.ok && tetap.data.hargaJual).toBe(3600);

    const dobel = await sbg(sa, () => simpanJenisSampah({ nama: ` ${nama.toUpperCase()}  `, hargaBeli: 1, aktif: true }));
    expect(dobel).toEqual(fail("VALIDASI_GAGAL", { fieldErrors: { nama: ["Nama jenis sampah sudah dipakai"] } }));

    expect(await sbg(sa, () => simpanJenisSampah({ id: "900000000000", nama: `${nama}x`, hargaBeli: 1, aktif: true }))).toEqual(
      fail("JENIS_SAMPAH_TIDAK_VALID"),
    );
    const invalid = await sbg(sa, () => simpanJenisSampah({ nama: "B", hargaBeli: 0, aktif: true }));
    expect(!invalid.ok && Object.keys(invalid.fieldErrors ?? {}).sort()).toEqual(["hargaBeli", "nama"]);

    const nasabah = await masuk(await buatAkun("nasabah"));
    expect(await sbg(nasabah, () => simpanJenisSampah({ nama: "Apa", hargaBeli: 1, aktif: true }))).toEqual(fail("TIDAK_DIIZINKAN"));
    expect(await sbg(nasabah, () => updateHargaSampah({ nama: "Apa", hargaBeli: 1, aktif: true }))).toEqual(fail("TIDAK_DIIZINKAN"));
  });

  it("default hanya aktif; staf boleh termasukNonaktif; nasabah hanya aktif & tanpa hargaJual", async () => {
    const aktif = await buatJenis(owner, 1111);
    const nonaktif = await buatJenis(owner, 2222, { aktif: false });
    const admin = await masuk(await buatAkun("admin"));
    const sa = await masuk(await buatAkun("super_admin"));
    const ids = async (b: Browser, input?: { termasukNonaktif?: boolean }) => {
      const h = await sbg(b, () => listJenisSampah(input));
      if (!h.ok) throw new Error(h.code);
      return h.data.map((j) => j.id);
    };
    expect(await ids(admin)).not.toContain(nonaktif);
    expect(await ids(admin, { termasukNonaktif: true })).toEqual(expect.arrayContaining([aktif, nonaktif]));
    expect(await ids(sa)).not.toContain(nonaktif);
    expect(await ids(sa, { termasukNonaktif: true })).toEqual(expect.arrayContaining([aktif, nonaktif]));

    const nasabah = await masuk(await buatAkun("nasabah"));
    expect(await ids(nasabah, { termasukNonaktif: true })).not.toContain(nonaktif);
    const katalog = await sbg(nasabah, () => listJenisSampah());
    if (!katalog.ok) throw new Error(katalog.code);
    expect(katalog.data.find((j) => j.id === aktif)).toEqual({
      id: aktif,
      nama: expect.any(String),
      hargaBeli: 1111,
      aktif: true,
      terakhirDiubah: null,
    });
    const viaAdmin = await sbg(admin, () => listJenisSampah());
    expect(viaAdmin.ok && viaAdmin.data.find((j) => j.id === aktif)).toMatchObject({ hargaJual: null });
    const salah = await sbg(sa, () => listJenisSampah({ termasukNonaktif: "ya" as unknown as boolean }));
    expect(!salah.ok && salah.code).toBe("VALIDASI_GAGAL");
  });
});

describe("riwayat harga (price_history)", () => {
  it("buat & ubah harga beli tercatat (ubah hargaJual saja tidak); terakhirDiubah; filter; hanya super_admin", async () => {
    const admin = await masuk(await buatAkun("admin", { nama: "Admin Harga" }));
    const sa = await masuk(await buatAkun("super_admin"));
    const nama = `Kaleng ${randomBytes(3).toString("hex")}`;
    const buat = await sbg(admin, () => simpanJenisSampah({ nama, hargaBeli: 1900, aktif: true }));
    if (!buat.ok) throw new Error(buat.code);
    const id = buat.data.id;
    const ubah = await sbg(admin, () => updateHargaSampah({ id, nama, hargaBeli: 2100, aktif: true }));
    expect(ubah.ok && ubah.data.hargaBeli).toBe(2100);
    await sbg(sa, () => simpanJenisSampah({ id, nama, hargaBeli: 2100, hargaJual: 2500, aktif: true }));

    const r = await sbg(sa, () => listRiwayatHarga({ sampahId: id }));
    if (!r.ok) throw new Error(r.code);
    expect(r.data.map((x) => [x.hargaLama, x.hargaBaru, x.diubahOlehNama])).toEqual([
      [1900, 2100, "Admin Harga"],
      [0, 1900, "Admin Harga"],
    ]);
    expect(r.data[0]).toMatchObject({ sampahId: id, sampahNama: nama, createdAt: expect.stringMatching(/Z$/) });

    const semua = await sbg(sa, () => listRiwayatHarga());
    expect(semua.ok && semua.data.filter((x) => x.sampahId === id)).toHaveLength(2);
    expect(await sbg(sa, () => listRiwayatHarga({ sampahId: "900000000000" }))).toEqual({ ok: true, data: [] });
    expect(await sbg(admin, () => listRiwayatHarga())).toEqual(fail("TIDAK_DIIZINKAN"));
    const salah = await sbg(sa, () => listRiwayatHarga({ sampahId: "abc" }));
    expect(!salah.ok && salah.code).toBe("VALIDASI_GAGAL");

    const k = await sbg(sa, () => listJenisSampah());
    expect(k.ok && k.data.find((j) => j.id === id)).toMatchObject({
      hargaJual: 2500,
      terakhirDiubah: { hargaLama: 1900, hargaBaru: 2100, diubahOlehNama: "Admin Harga", waktu: expect.stringMatching(/Z$/) },
    });
  });

  it("app_server: SELECT & INSERT saja (append-only); anon tanpa akses; RLS aktif", async () => {
    const [r] = await owner`
      select has_table_privilege('app_server', 'public.price_history', 'SELECT') as sel,
             has_table_privilege('app_server', 'public.price_history', 'INSERT') as ins,
             has_table_privilege('app_server', 'public.price_history', 'UPDATE') as upd,
             has_table_privilege('app_server', 'public.price_history', 'DELETE') as del,
             has_table_privilege('anon', 'public.price_history', 'SELECT') as anon_sel,
             (select relrowsecurity from pg_class where oid = 'public.price_history'::regclass) as rls`;
    expect(r).toEqual({ sel: true, ins: true, upd: false, del: false, anon_sel: false, rls: true });
  });
});

describe("listStaf (super_admin)", () => {
  it("hanya admin & super_admin; admin -> TIDAK_DIIZINKAN", async () => {
    const n = await buatAkun("nasabah");
    const ad = await buatAkun("admin");
    const saAkun = await buatAkun("super_admin");
    const sa = await masuk(saAkun);
    const h = await sbg(sa, () => listStaf());
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.data.every((p) => p.role === "admin" || p.role === "super_admin")).toBe(true);
    const ids = h.data.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([ad.userId, saAkun.userId]));
    expect(ids).not.toContain(n.userId);
    expect(await sbg(await masuk(ad), () => listStaf())).toEqual(fail("TIDAK_DIIZINKAN"));
  });
});
