import { describe, expect, it } from "vitest";
import { bukaKoneksi } from "./clients";
import { expectDbError, pgErrorDari } from "./errors";
import { buatKonteks, isiSaldo, setAktif } from "./factories";
import { gagal, koreksi, paralel, saldo, sukses, tarik } from "./ledger";

const { owner, app, paralel: clients } = bukaKoneksi();
const ITERASI = 25;

async function baris(id: string) {
  const [r] = await owner`
    select customer_id, tipe, jumlah, dibuat_oleh, reverses_id::text, catatan
    from public.transactions where id = ${id}`;
  return { ...r };
}

describe("E. koreksi", () => {
  it("membalik setor: customer_id disalin dari asli, jumlah dibalik", async () => {
    const k = await buatKonteks(owner);
    const asli = await isiSaldo(app, k, 5_000);
    const h = await koreksi(app, { originalId: asli, adminId: k.superAdmin, alasan: "salah timbang" });
    expect(h).toMatchObject({ saldoBaru: "0", duplikat: false });
    expect(await baris(h.transactionId)).toEqual({
      customer_id: k.nasabah,
      tipe: "koreksi",
      jumlah: -5_000,
      dibuat_oleh: k.superAdmin,
      reverses_id: asli,
      catatan: "salah timbang",
    });
    expect(await saldo(owner, k.nasabah)).toBe(0n);
  });

  it("membalik tarik: saldo kembali", async () => {
    const k = await buatKonteks(owner);
    await isiSaldo(app, k, 5_000);
    const t = await tarik(app, { customerId: k.nasabah, adminId: k.admin, jumlah: 2_000 });
    const h = await koreksi(app, { originalId: t.transactionId, adminId: k.superAdmin });
    expect(h.saldoBaru).toBe("5000");
    expect(await baris(h.transactionId)).toMatchObject({
      customer_id: k.nasabah,
      tipe: "koreksi",
      jumlah: 2_000,
      reverses_id: t.transactionId,
    });
  });

  it("koreksi nasabah nonaktif tetap boleh", async () => {
    const k = await buatKonteks(owner);
    const asli = await isiSaldo(app, k, 700);
    await setAktif(owner, k.nasabah, false);
    expect((await koreksi(app, { originalId: asli, adminId: k.superAdmin })).saldoBaru).toBe("0");
  });

  it("koreksi ganda sekuensial -> TRANSAKSI_SUDAH_DIBALIK", async () => {
    const k = await buatKonteks(owner);
    const asli = await isiSaldo(app, k, 1_000);
    await koreksi(app, { originalId: asli, adminId: k.superAdmin });
    await expectDbError(koreksi(app, { originalId: asli, adminId: k.superAdmin }), "TRANSAKSI_SUDAH_DIBALIK");
  });

  it("koreksi atas koreksi -> TRANSAKSI_TIDAK_BISA_DIBALIK", async () => {
    const k = await buatKonteks(owner);
    await isiSaldo(app, k, 3_000);
    const t = await tarik(app, { customerId: k.nasabah, adminId: k.admin, jumlah: 1_000 });
    const kor = await koreksi(app, { originalId: t.transactionId, adminId: k.superAdmin });
    await expectDbError(
      koreksi(app, { originalId: kor.transactionId, adminId: k.superAdmin }),
      "TRANSAKSI_TIDAK_BISA_DIBALIK",
    );
  });

  it("koreksi yang membuat saldo minus -> KOREKSI_MEMBUAT_SALDO_MINUS", async () => {
    const k = await buatKonteks(owner);
    const asli = await isiSaldo(app, k, 1_000);
    await tarik(app, { customerId: k.nasabah, adminId: k.admin, jumlah: 700 });
    await expectDbError(koreksi(app, { originalId: asli, adminId: k.superAdmin }), "KOREKSI_MEMBUAT_SALDO_MINUS");
    expect(await saldo(owner, k.nasabah)).toBe(300n);
  });

  it("admin biasa / admin nonaktif -> TIDAK_DIIZINKAN", async () => {
    const k = await buatKonteks(owner);
    const asli = await isiSaldo(app, k, 1_000);
    await expectDbError(koreksi(app, { originalId: asli, adminId: k.admin }), "TIDAK_DIIZINKAN");
    await setAktif(owner, k.superAdmin, false);
    await expectDbError(koreksi(app, { originalId: asli, adminId: k.superAdmin }), "TIDAK_DIIZINKAN");
  });

  it("id tidak ada -> TRANSAKSI_TIDAK_DITEMUKAN; alasan kosong -> VALIDASI_GAGAL", async () => {
    const k = await buatKonteks(owner);
    await expectDbError(
      koreksi(app, { originalId: "900000000000", adminId: k.superAdmin }),
      "TRANSAKSI_TIDAK_DITEMUKAN",
    );
    const asli = await isiSaldo(app, k, 1_000);
    await expectDbError(koreksi(app, { originalId: asli, adminId: k.superAdmin, alasan: "   " }), "VALIDASI_GAGAL");
  });

  for (const jenis of ["setor", "tarik"] as const) {
    it(`dua koreksi PARALEL (UUID beda) ke ${jenis} yang sama -> satu sukses, satu TRANSAKSI_SUDAH_DIBALIK (x${ITERASI})`, async () => {
      for (let i = 0; i < ITERASI; i++) {
        const k = await buatKonteks(owner);
        const idSetor = await isiSaldo(app, k, 1_000);
        const target =
          jenis === "setor"
            ? idSetor
            : (await tarik(app, { customerId: k.nasabah, adminId: k.admin, jumlah: 400 })).transactionId;
        const rs = await paralel(clients, [
          (tx) => koreksi(tx, { originalId: target, adminId: k.superAdmin }),
          (tx) => koreksi(tx, { originalId: target, adminId: k.superAdmin }),
        ]);
        expect(sukses(rs), `iterasi ${i}: jumlah sukses`).toHaveLength(1);
        // Harus kode kontrak, bukan SERVER_ERROR / unique_violation / KOREKSI_MEMBUAT_SALDO_MINUS.
        expect(pgErrorDari(gagal(rs)[0]).message, `iterasi ${i}: kode error`).toBe("TRANSAKSI_SUDAH_DIBALIK");
        const [n] = await owner`select count(*)::int as n from public.transactions where reverses_id = ${target}`;
        expect(n.n).toBe(1);
        expect(await saldo(owner, k.nasabah)).toBe(jenis === "setor" ? 0n : 1_000n);
      }
    });
  }

  it(`tarik vs koreksi setor PARALEL atas saldo 1000 -> tepat satu sukses, saldo >= 0 (x${ITERASI})`, async () => {
    const hasil = { tarik: 0, koreksi: 0 };
    for (let i = 0; i < ITERASI; i++) {
      const k = await buatKonteks(owner);
      const asli = await isiSaldo(app, k, 1_000);
      // Urutan dibalik tiap iterasi supaya kedua pemenang teruji.
      const fns = [
        (tx: Parameters<typeof tarik>[0]) => tarik(tx, { customerId: k.nasabah, adminId: k.admin, jumlah: 1_000 }),
        (tx: Parameters<typeof tarik>[0]) => koreksi(tx, { originalId: asli, adminId: k.superAdmin }),
      ];
      const urut = i % 2 === 0 ? fns : [...fns].reverse();
      const rs = await paralel(clients, urut);
      expect(sukses(rs), `iterasi ${i}: jumlah sukses`).toHaveLength(1);
      const kode = pgErrorDari(gagal(rs)[0]).message;
      expect(["SALDO_TIDAK_CUKUP", "KOREKSI_MEMBUAT_SALDO_MINUS"]).toContain(kode);
      hasil[kode === "SALDO_TIDAK_CUKUP" ? "koreksi" : "tarik"]++;
      expect(await saldo(owner, k.nasabah)).toBe(0n);
    }
    expect(hasil.tarik + hasil.koreksi).toBe(ITERASI);
  });
});
