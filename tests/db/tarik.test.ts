import { describe, expect, it } from "vitest";
import { bukaKoneksi } from "./clients";
import { expectDbError, pgErrorDari } from "./errors";
import { buatKonteks, isiSaldo, setAktif } from "./factories";
import { gagal, paralel, saldo, sukses, tarik } from "./ledger";

const { owner, app, paralel: clients } = bukaKoneksi();
const ITERASI = 25;

describe("C. tarik", () => {
  it("saldo cukup: saldo berkurang, jumlah di ledger negatif", async () => {
    const k = await buatKonteks(owner);
    await isiSaldo(app, k, 10_000);
    const h = await tarik(app, { customerId: k.nasabah, adminId: k.admin, jumlah: 3_500 });
    expect(h).toMatchObject({ saldoBaru: "6500", duplikat: false });
    const [r] = await owner`select tipe, jumlah from public.transactions where id = ${h.transactionId}`;
    expect({ ...r }).toEqual({ tipe: "tarik", jumlah: -3_500 });
    expect(await saldo(owner, k.nasabah)).toBe(6_500n);
  });

  it("tarik pas habis: saldo jadi 0", async () => {
    const k = await buatKonteks(owner);
    await isiSaldo(app, k, 4_321);
    const h = await tarik(app, { customerId: k.nasabah, adminId: k.admin, jumlah: 4_321 });
    expect(h.saldoBaru).toBe("0");
    expect(await saldo(owner, k.nasabah)).toBe(0n);
  });

  it("saldo kurang -> SALDO_TIDAK_CUKUP, ledger tidak berubah", async () => {
    const k = await buatKonteks(owner);
    await isiSaldo(app, k, 1_000);
    await expectDbError(tarik(app, { customerId: k.nasabah, adminId: k.admin, jumlah: 1_001 }), "SALDO_TIDAK_CUKUP");
    const kosong = await buatKonteks(owner);
    await expectDbError(tarik(app, { customerId: kosong.nasabah, adminId: kosong.admin, jumlah: 1 }), "SALDO_TIDAK_CUKUP");
    expect(await saldo(owner, k.nasabah)).toBe(1_000n);
  });

  it("jumlah 0 / negatif -> VALIDASI_GAGAL", async () => {
    const k = await buatKonteks(owner);
    await isiSaldo(app, k, 1_000);
    await expectDbError(tarik(app, { customerId: k.nasabah, adminId: k.admin, jumlah: 0 }), "VALIDASI_GAGAL");
    await expectDbError(tarik(app, { customerId: k.nasabah, adminId: k.admin, jumlah: -5 }), "VALIDASI_GAGAL");
  });

  it("nasabah NONAKTIF tetap boleh tarik (sisa saldo hak nasabah)", async () => {
    const k = await buatKonteks(owner);
    await isiSaldo(app, k, 2_000);
    await setAktif(owner, k.nasabah, false);
    const h = await tarik(app, { customerId: k.nasabah, adminId: k.admin, jumlah: 2_000 });
    expect(h.saldoBaru).toBe("0");
  });

  it("admin bukan admin / customer bukan nasabah ditolak", async () => {
    const k = await buatKonteks(owner);
    await isiSaldo(app, k, 1_000);
    await expectDbError(tarik(app, { customerId: k.nasabah, adminId: k.nasabah, jumlah: 1 }), "TIDAK_DIIZINKAN");
    await setAktif(owner, k.admin, false);
    await expectDbError(tarik(app, { customerId: k.nasabah, adminId: k.admin, jumlah: 1 }), "TIDAK_DIIZINKAN");
    await expectDbError(
      tarik(app, { customerId: k.superAdmin, adminId: k.superAdmin, jumlah: 1 }),
      "NASABAH_TIDAK_DITEMUKAN",
    );
  });

  it(`dua tarik PARALEL, UUID beda, total > saldo -> tepat satu sukses, saldo >= 0 (x${ITERASI})`, async () => {
    for (let i = 0; i < ITERASI; i++) {
      const k = await buatKonteks(owner);
      await isiSaldo(app, k, 1_000);
      const rs = await paralel(clients, [
        (tx) => tarik(tx, { customerId: k.nasabah, adminId: k.admin, jumlah: 600 }),
        (tx) => tarik(tx, { customerId: k.nasabah, adminId: k.admin, jumlah: 600 }),
      ]);
      const akhir = await saldo(owner, k.nasabah);
      expect(akhir, `iterasi ${i}: saldo akhir`).toBeGreaterThanOrEqual(0n);
      expect(sukses(rs), `iterasi ${i}: jumlah sukses`).toHaveLength(1);
      expect(sukses(rs)[0].saldoBaru).toBe("400");
      expect(pgErrorDari(gagal(rs)[0]).message).toBe("SALDO_TIDAK_CUKUP");
      expect(akhir).toBe(400n);
    }
  });

  it(`10 tarik kecil PARALEL, total > saldo -> saldo tidak pernah minus (x${ITERASI})`, async () => {
    for (let i = 0; i < ITERASI; i++) {
      const k = await buatKonteks(owner);
      await isiSaldo(app, k, 1_000);
      const rs = await paralel(
        clients,
        Array.from({ length: 10 }, () => (tx) => tarik(tx, { customerId: k.nasabah, adminId: k.admin, jumlah: 150 })),
        20,
      );
      const ok = sukses(rs);
      for (const h of ok) expect(BigInt(h.saldoBaru)).toBeGreaterThanOrEqual(0n);
      for (const e of gagal(rs)) expect(pgErrorDari(e).message).toBe("SALDO_TIDAK_CUKUP");
      // 1000 / 150 = 6 tarik muat, sisa 100.
      expect(ok, `iterasi ${i}: jumlah sukses`).toHaveLength(6);
      expect(await saldo(owner, k.nasabah)).toBe(100n);
      expect(ok.map((h) => h.saldoBaru).sort()).toEqual(["100", "250", "400", "550", "700", "850"]);
    }
  });
});
