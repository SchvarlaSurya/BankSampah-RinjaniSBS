import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSetorFormData, fail } from "@/contract";
import { GET as devFoto } from "@/app/api/dev-foto/[name]/route";
import { koreksi, setor, tarik } from "@/server/api/actions";
import { auditTransaksi, getHistori, getTransaksi } from "@/server/api/queries";
import { bukaKoneksi } from "../db/clients";
import { buatJenis } from "../db/factories";
import { type Akun, buatAkun, masuk, sbg } from "./akun";
import { bytesJpeg, fileFoto } from "./foto";
import { Browser } from "./next-headers-mock";

const { owner } = bukaKoneksi();

let nasabah: Akun;
let bNasabah: Browser;
let admin: Browser;
let adminAkun: Akun;
let superAdmin: Browser;
let jenis: string;

beforeEach(async () => {
  nasabah = await buatAkun("nasabah");
  bNasabah = await masuk(nasabah);
  adminAkun = await buatAkun("admin");
  admin = await masuk(adminAkun);
  superAdmin = await masuk(await buatAkun("super_admin"));
  jenis = await buatJenis(owner, 1000);
});

async function setorSebagai(b: Browser, customerId = nasabah.userId, bytes = bytesJpeg()) {
  const h = await sbg(b, () =>
    setor(
      buildSetorFormData(
        { customerId, items: [{ wasteTypeId: jenis, berat: "10" }], clientRequestId: randomUUID() },
        fileFoto(bytes),
      ),
    ),
  );
  if (!h.ok) throw new Error(h.code);
  return h.data.transaksi;
}

describe("getTransaksi", () => {
  it("nasabah hanya transaksinya sendiri (lainnya TRANSAKSI_TIDAK_DITEMUKAN); fotoUrl hanya super_admin", async () => {
    const milik = await setorSebagai(admin);
    const lain = await buatAkun("nasabah");
    const punyaLain = await setorSebagai(admin, lain.userId);

    const own = await sbg(bNasabah, () => getTransaksi({ id: milik.id }));
    expect(own.ok && own.data.fotoUrl).toBeNull();
    expect(await sbg(bNasabah, () => getTransaksi({ id: punyaLain.id }))).toEqual(fail("TRANSAKSI_TIDAK_DITEMUKAN"));
    expect(await sbg(bNasabah, () => getTransaksi({ id: "900000000000" }))).toEqual(fail("TRANSAKSI_TIDAK_DITEMUKAN"));
    const salah = await sbg(bNasabah, () => getTransaksi({ id: "abc" }));
    expect(!salah.ok && salah.code).toBe("VALIDASI_GAGAL");

    const viaAdmin = await sbg(admin, () => getTransaksi({ id: punyaLain.id }));
    expect(viaAdmin.ok && viaAdmin.data.fotoUrl).toBeNull();
    const viaSa = await sbg(superAdmin, () => getTransaksi({ id: punyaLain.id }));
    expect(viaSa.ok && viaSa.data.fotoUrl).toMatch(/^\/api\/dev-foto\//);
  });
});

describe("getHistori", () => {
  it("urut id DESC, cursor + nextCursor (limit+1), sudahDibalik & membalikId", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push((await setorSebagai(admin)).id);
    const t = await sbg(admin, () => tarik({ customerId: nasabah.userId, jumlah: 1000, clientRequestId: randomUUID() }));
    if (!t.ok) throw new Error(t.code);
    const kor = await sbg(superAdmin, () => koreksi({ transaksiId: ids[0], alasan: "salah input", clientRequestId: randomUUID() }));
    if (!kor.ok) throw new Error(kor.code);
    const semua = [kor.data.transaksi.id, t.data.transaksi.id, ...[...ids].reverse()];

    const dapat: string[] = [];
    let cursor: string | undefined;
    const halaman: (string | null)[] = [];
    do {
      const h = await sbg(admin, () => getHistori({ customerId: nasabah.userId, limit: 2, cursor }));
      if (!h.ok) throw new Error(h.code);
      dapat.push(...h.data.items.map((x) => x.id));
      halaman.push(h.data.nextCursor);
      cursor = h.data.nextCursor ?? undefined;
    } while (cursor);
    expect(dapat).toEqual(semua);
    expect(halaman).toEqual([semua[1], semua[3], null]);

    const h = await sbg(admin, () => getHistori({ customerId: nasabah.userId, limit: 50 }));
    if (!h.ok) throw new Error(h.code);
    const byId = Object.fromEntries(h.data.items.map((x) => [x.id, x]));
    expect(byId[ids[0]]).toMatchObject({ sudahDibalik: true, membalikId: null, tipe: "setor", jumlah: 10_000 });
    expect(byId[kor.data.transaksi.id]).toMatchObject({ sudahDibalik: false, membalikId: ids[0], tipe: "koreksi", catatan: "salah input" });
    expect(byId[t.data.transaksi.id]).toMatchObject({ tipe: "tarik", jumlah: -1000, dibuatOlehNama: "Tes admin" });
  });

  it("nasabah dipaksa ke dirinya sendiri; admin + customer bukan nasabah -> NASABAH_TIDAK_DITEMUKAN", async () => {
    await setorSebagai(admin);
    const lain = await buatAkun("nasabah");
    const punyaLain = await setorSebagai(admin, lain.userId);
    const h = await sbg(bNasabah, () => getHistori({ customerId: lain.userId }));
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.data.items.map((x) => x.id)).not.toContain(punyaLain.id);
    expect(h.data.items).toHaveLength(1);
    expect(await sbg(admin, () => getHistori({ customerId: adminAkun.userId }))).toEqual(fail("NASABAH_TIDAK_DITEMUKAN"));
    expect(await sbg(new Browser(), () => getHistori({ customerId: nasabah.userId }))).toEqual(fail("TIDAK_LOGIN"));
  });
});

describe("auditTransaksi (super_admin)", () => {
  /** Transaksi tarik dengan waktu tertentu, langsung sebagai owner (fungsi SQL selalu now()). */
  async function tarikPadaWaktu(adminId: string, waktuUtc: string): Promise<string> {
    const [r] = await owner`
      insert into public.transactions (customer_id, tipe, jumlah, dibuat_oleh, waktu, client_request_id)
      values (${nasabah.userId}, 'tarik', -1, ${adminId}, ${waktuUtc}::timestamptz, ${randomUUID()}::uuid)
      returning id::text`;
    return r.id;
  }

  it("filter tanggal = kalender Asia/Jakarta, inklusif, di sekitar tengah malam WIB", async () => {
    const pembuat = (await buatAkun("admin")).userId;
    // WIB = UTC+7.
    const t14Akhir = await tarikPadaWaktu(pembuat, "2026-03-14T16:59:59.999Z"); // 14 Mar 23:59:59.999 WIB
    const t15Awal = await tarikPadaWaktu(pembuat, "2026-03-14T17:00:00.000Z"); //  15 Mar 00:00:00.000 WIB
    const t15Akhir = await tarikPadaWaktu(pembuat, "2026-03-15T16:59:59.999Z"); // 15 Mar 23:59:59.999 WIB
    const t16Awal = await tarikPadaWaktu(pembuat, "2026-03-15T17:00:00.000Z"); //  16 Mar 00:00:00.000 WIB

    const ids = async (dari?: string, sampai?: string) => {
      const h = await sbg(superAdmin, () => auditTransaksi({ adminId: pembuat, dari, sampai, limit: 50 }));
      if (!h.ok) throw new Error(h.code);
      return h.data.items.map((d) => d.id);
    };
    expect(await ids("2026-03-15", "2026-03-15")).toEqual([t15Akhir, t15Awal]);
    expect(await ids("2026-03-14", "2026-03-14")).toEqual([t14Akhir]);
    expect(await ids("2026-03-16", undefined)).toEqual([t16Awal]);
    expect(await ids(undefined, "2026-03-14")).toEqual([t14Akhir]);
    expect(await ids("2026-03-14", "2026-03-16")).toEqual([t16Awal, t15Akhir, t15Awal, t14Akhir]);
    expect(await ids("2026-03-17", "2026-03-13")).toEqual([]);
  });

  it("filter admin & tipe, cursor, TransaksiDetail + foto; tanggal tidak ada -> VALIDASI_GAGAL; admin ditolak", async () => {
    const s1 = await setorSebagai(admin);
    const s2 = await setorSebagai(admin);
    const t = await sbg(admin, () => tarik({ customerId: nasabah.userId, jumlah: 1, clientRequestId: randomUUID() }));
    if (!t.ok) throw new Error(t.code);

    const h1 = await sbg(superAdmin, () => auditTransaksi({ adminId: adminAkun.userId, tipe: "setor", limit: 1 }));
    if (!h1.ok) throw new Error(h1.code);
    expect(h1.data.items.map((d) => d.id)).toEqual([s2.id]);
    expect(h1.data.nextCursor).toBe(s2.id);
    expect(h1.data.items[0].fotoUrl).toMatch(/^\/api\/dev-foto\//);
    expect(h1.data.items[0].items).toHaveLength(1);
    const h2 = await sbg(superAdmin, () => auditTransaksi({ adminId: adminAkun.userId, tipe: "setor", limit: 1, cursor: h1.data.nextCursor! }));
    expect(h2.ok && h2.data).toMatchObject({ items: [{ id: s1.id }], nextCursor: null });

    const tidakAda = await sbg(superAdmin, () => auditTransaksi({ dari: "2026-02-30" }));
    expect(tidakAda).toEqual(fail("VALIDASI_GAGAL", { fieldErrors: { dari: ["Tanggal tidak valid"] } }));
    expect(await sbg(admin, () => auditTransaksi({}))).toEqual(fail("TIDAK_DIIZINKAN"));
  });
});

describe("route dev foto (app/api/dev-foto/[name])", () => {
  async function ambil(b: Browser, url: string) {
    const u = new URL(url, "http://localhost:3000");
    const nama = u.pathname.split("/").pop()!;
    return sbg(b, () => devFoto(new Request(u), { params: Promise.resolve({ name: nama }) }));
  }

  it("hanya super_admin + tanda tangan sah; nasabah/admin/anonim ditolak; di produksi 404", async () => {
    const bytes = bytesJpeg();
    const s = await setorSebagai(admin, nasabah.userId, bytes);
    const d = await sbg(superAdmin, () => getTransaksi({ id: s.id }));
    if (!d.ok || !d.data.fotoUrl) throw new Error("tidak ada fotoUrl");
    const url = d.data.fotoUrl;

    const ok = await ambil(superAdmin, url);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/jpeg");
    expect(ok.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(bytes);

    for (const b of [bNasabah, admin, new Browser()]) expect((await ambil(b, url)).status).toBe(403);
    expect((await ambil(superAdmin, url.replace(/sig=[0-9a-f]{4}/, "sig=0000"))).status).toBe(403);
    expect((await ambil(superAdmin, url.replace(/exp=\d+/, "exp=1000"))).status).toBe(403);
    expect((await ambil(superAdmin, `/api/dev-foto/..%2F..%2Fpackage.json?exp=9999999999&sig=00`)).status).toBe(403);

    const env = process.env as Record<string, string | undefined>;
    const asli = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      expect((await ambil(superAdmin, url)).status).toBe(404);
    } finally {
      env.NODE_ENV = asli;
    }
  });
});
