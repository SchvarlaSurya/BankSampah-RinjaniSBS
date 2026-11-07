import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { fail } from "@/contract";
import { koreksi, sesuaikanSaldo, tarik } from "@/server/api/actions";
import { auditTransaksi, getHistori, getNasabah, getTransaksi } from "@/server/api/queries";
import { bukaKoneksi } from "../db/clients";
import { type Akun, buatAkun, masuk, sbg } from "./akun";
import type { Browser } from "./next-headers-mock";

const { owner, app } = bukaKoneksi();

let nasabah: Akun;
let admin: Browser;
let adminAkun: Akun;
let superAdmin: Browser;
beforeEach(async () => {
  nasabah = await buatAkun("nasabah");
  adminAkun = await buatAkun("admin", { nama: "Admin Penyesuaian" });
  admin = await masuk(adminAkun);
  superAdmin = await masuk(await buatAkun("super_admin"));
});

const sesuaikan = (b: Browser, jumlah: number, alasan = "saldo awal buku manual", clientRequestId = randomUUID()) =>
  sbg(b, () => sesuaikanSaldo({ customerId: nasabah.userId, jumlah, alasan, clientRequestId }));

describe("sesuaikanSaldo (penyesuaian)", () => {
  it("tambah & kurangi: transaksi baru bertanda + alasan, saldo dari ledger, tampil di histori & audit", async () => {
    const tambah = await sesuaikan(admin, 50_000, "  saldo awal buku manual  ");
    if (!tambah.ok) throw new Error(tambah.code);
    expect(tambah.data).toMatchObject({ saldoBaru: 50_000, duplikat: false });
    expect(tambah.data.transaksi).toMatchObject({
      tipe: "penyesuaian",
      jumlah: 50_000,
      catatan: "saldo awal buku manual",
      dibuatOlehNama: "Admin Penyesuaian",
      items: [],
      fotoUrl: null,
      membalikId: null,
    });
    expect(await sbg(admin, () => getTransaksi({ id: tambah.data.transaksi.id }))).toEqual({ ok: true, data: tambah.data.transaksi });

    const kurang = await sesuaikan(superAdmin, -12_500, "salah hitung timbangan 3 Okt");
    expect(kurang.ok && kurang.data.saldoBaru).toBe(37_500);
    const n = await sbg(admin, () => getNasabah({ customerId: nasabah.userId }));
    expect(n.ok && n.data.saldo).toBe(37_500);

    const h = await sbg(admin, () => getHistori({ customerId: nasabah.userId }));
    expect(h.ok && h.data.items.map((x) => [x.tipe, x.jumlah])).toEqual([
      ["penyesuaian", -12_500],
      ["penyesuaian", 50_000],
    ]);
    const a = await sbg(superAdmin, () => auditTransaksi({ tipe: "penyesuaian", adminId: adminAkun.userId }));
    expect(a.ok && a.data.items.map((x) => x.id)).toEqual([tambah.data.transaksi.id]);
  });

  it("saldo tidak boleh minus; retry UUID sama = duplikat; UUID sama untuk operasi lain ditolak", async () => {
    await sesuaikan(admin, 1_000);
    expect(await sesuaikan(admin, -1_001)).toEqual(fail("SALDO_TIDAK_CUKUP"));

    const uuid = randomUUID();
    const pertama = await sesuaikan(admin, -1_000, "dikembalikan tunai", uuid);
    expect(pertama.ok && pertama.data.saldoBaru).toBe(0);
    const ulang = await sesuaikan(admin, -1_000, "dikembalikan tunai", uuid);
    expect(ulang.ok && ulang.data).toMatchObject({ duplikat: true, saldoBaru: 0, transaksi: { id: pertama.ok && pertama.data.transaksi.id } });

    const bentrok = await sbg(admin, () => tarik({ customerId: nasabah.userId, jumlah: 1, clientRequestId: uuid }));
    expect(!bentrok.ok && bentrok.code).toBe("VALIDASI_GAGAL");
  });

  it("validasi, akses, target bukan nasabah; nasabah nonaktif tetap boleh disesuaikan", async () => {
    for (const [jumlah, alasan] of [[0, "alasan cukup"], [1.5, "alasan cukup"], [100_000_001, "alasan cukup"], [10, "abc"]] as const) {
      const h = await sesuaikan(admin, jumlah, alasan);
      expect(!h.ok && h.code, `${jumlah}/${alasan}`).toBe("VALIDASI_GAGAL");
    }
    const bukan = await sbg(admin, () =>
      sesuaikanSaldo({ customerId: adminAkun.userId, jumlah: 10, alasan: "alasan cukup", clientRequestId: randomUUID() }),
    );
    expect(bukan).toEqual(fail("NASABAH_TIDAK_DITEMUKAN"));
    const n = await masuk(await buatAkun("nasabah"));
    expect(await sesuaikan(n, 10)).toEqual(fail("TIDAK_DIIZINKAN"));

    await owner`update public."user" set aktif = false where id = ${nasabah.userId}`;
    const nonaktif = await sesuaikan(admin, 10);
    expect(nonaktif.ok && nonaktif.data.saldoBaru).toBe(10);
  });

  it("penyesuaian bisa dikoreksi super_admin (dibalik penuh)", async () => {
    const p = await sesuaikan(admin, 7_000);
    if (!p.ok) throw new Error(p.code);
    const k = await sbg(superAdmin, () => koreksi({ transaksiId: p.data.transaksi.id, alasan: "salah nasabah", clientRequestId: randomUUID() }));
    expect(k.ok && k.data).toMatchObject({ saldoBaru: 0, transaksi: { tipe: "koreksi", jumlah: -7_000, membalikId: p.data.transaksi.id } });
  });

  it("DB: hanya lewat fungsi; CHECK menolak penyesuaian tanpa alasan; anon tidak bisa EXECUTE", async () => {
    await expect(
      app`insert into public.transactions (customer_id, tipe, jumlah, dibuat_oleh, catatan, client_request_id)
          values (${nasabah.userId}, 'penyesuaian', 5, ${adminAkun.userId}, 'x', ${randomUUID()}::uuid)`,
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      owner`insert into public.transactions (customer_id, tipe, jumlah, dibuat_oleh, catatan, client_request_id)
            values (${nasabah.userId}, 'penyesuaian', 5, ${adminAkun.userId}, '  ', ${randomUUID()}::uuid)`,
    ).rejects.toMatchObject({ constraint_name: "transactions_penyesuaian_valid" });
    const [r] = await owner`
      select has_function_privilege('anon', 'public.penyesuaian(text,text,uuid,integer,text)', 'EXECUTE') as anon,
             has_function_privilege('authenticated', 'public.penyesuaian(text,text,uuid,integer,text)', 'EXECUTE') as auth,
             has_function_privilege('app_server', 'public.penyesuaian(text,text,uuid,integer,text)', 'EXECUTE') as app`;
    expect(r).toEqual({ anon: false, auth: false, app: true });
  });
});
