import { describe, expect, it } from "vitest";
import { bukaKoneksi, type Db } from "./clients";
import { expectDbError } from "./errors";
import { buatKonteks, buatUser, isiSaldo, setAktif } from "./factories";
import {
  type Hasil,
  hashBaru,
  itemsJson,
  jumlahBaris,
  koreksi,
  paralel,
  saldo,
  setor,
  sukses,
  tarik,
  uuidBaru,
} from "./ledger";

const { owner, app, paralel: clients } = bukaKoneksi();
const ITERASI = 25;

async function barisDenganUuid(uuid: string): Promise<number> {
  const [r] = await owner`select count(*)::int as n from public.transactions where client_request_id = ${uuid}::uuid`;
  return r.n;
}

describe("D. idempotensi", () => {
  it("retry sekuensial setor/tarik/koreksi: id sama, duplikat=true, saldo_baru = saldo SAAT INI", async () => {
    const k = await buatKonteks(owner);
    const items = itemsJson([{ wasteTypeId: k.jenis100, berat: "50.00" }]);
    const hash = hashBaru();

    const uSetor = uuidBaru();
    const setorAsli = await setor(app, { customerId: k.nasabah, adminId: k.admin, clientRequestId: uSetor, items, hashFoto: hash });
    expect(setorAsli).toMatchObject({ saldoBaru: "5000", duplikat: false });

    const uTarik = uuidBaru();
    const tarikAsli = await tarik(app, { customerId: k.nasabah, adminId: k.admin, clientRequestId: uTarik, jumlah: 1_000 });
    expect(tarikAsli.saldoBaru).toBe("4000");

    const uKoreksi = uuidBaru();
    const koreksiAsli = await koreksi(app, {
      originalId: tarikAsli.transactionId,
      adminId: k.superAdmin,
      clientRequestId: uKoreksi,
    });
    expect(koreksiAsli.saldoBaru).toBe("5000");

    // Transaksi lain di antara asli dan retry: saldo sekarang 5000 + 300 = 5300.
    await isiSaldo(app, k, 300);
    const barisSebelum = await jumlahBaris(owner, k.nasabah);

    const retry: Hasil[] = [
      await setor(app, { customerId: k.nasabah, adminId: k.admin, clientRequestId: uSetor, items, hashFoto: hash }),
      await tarik(app, { customerId: k.nasabah, adminId: k.admin, clientRequestId: uTarik, jumlah: 1_000 }),
      await koreksi(app, { originalId: tarikAsli.transactionId, adminId: k.superAdmin, clientRequestId: uKoreksi }),
    ];
    expect(retry).toEqual([
      { transactionId: setorAsli.transactionId, saldoBaru: "5300", duplikat: true },
      { transactionId: tarikAsli.transactionId, saldoBaru: "5300", duplikat: true },
      { transactionId: koreksiAsli.transactionId, saldoBaru: "5300", duplikat: true },
    ]);
    expect(await jumlahBaris(owner, k.nasabah)).toBe(barisSebelum);
    expect(await saldo(owner, k.nasabah)).toBe(5_300n);
  });

  it("retry dengan item / hash / jumlah / alasan berbeda tetap duplikat=true tanpa baris baru", async () => {
    const k = await buatKonteks(owner);
    const uSetor = uuidBaru();
    const asli = await setor(app, {
      customerId: k.nasabah,
      adminId: k.admin,
      clientRequestId: uSetor,
      items: itemsJson([{ wasteTypeId: k.jenis100, berat: "10.00" }]),
    });
    const beda = await setor(app, {
      customerId: k.nasabah,
      adminId: k.admin,
      clientRequestId: uSetor,
      items: itemsJson([{ wasteTypeId: k.jenis100, berat: "99.00" }]),
      hashFoto: hashBaru(),
      pathFoto: "lain.jpg",
    });
    expect(beda).toEqual({ transactionId: asli.transactionId, saldoBaru: "1000", duplikat: true });

    const uTarik = uuidBaru();
    const t = await tarik(app, { customerId: k.nasabah, adminId: k.admin, clientRequestId: uTarik, jumlah: 100 });
    // Jumlah berbeda bahkan melebihi saldo: tetap transaksi asli, bukan SALDO_TIDAK_CUKUP.
    expect(await tarik(app, { customerId: k.nasabah, adminId: k.admin, clientRequestId: uTarik, jumlah: 999_999 })).toEqual({
      transactionId: t.transactionId,
      saldoBaru: "900",
      duplikat: true,
    });

    const uKor = uuidBaru();
    const kor = await koreksi(app, { originalId: t.transactionId, adminId: k.superAdmin, clientRequestId: uKor, alasan: "a" });
    expect(
      await koreksi(app, { originalId: t.transactionId, adminId: k.superAdmin, clientRequestId: uKor, alasan: "lain" }),
    ).toEqual({ transactionId: kor.transactionId, saldoBaru: "1000", duplikat: true });

    for (const u of [uSetor, uTarik, uKor]) expect(await barisDenganUuid(u)).toBe(1);
    expect(await jumlahBaris(owner, k.nasabah)).toBe(3);
  });

  it("UUID dipakai untuk tipe / customer / admin / reverses_id lain -> VALIDASI_GAGAL", async () => {
    const k = await buatKonteks(owner);
    const nasabahLain = await buatUser(owner, "nasabah");
    const adminLain = await buatUser(owner, "admin");
    const superLain = await buatUser(owner, "super_admin");
    const items = itemsJson([{ wasteTypeId: k.jenis100, berat: "20.00" }]);
    await isiSaldo(app, k, 1_000, nasabahLain);

    const uSetor = uuidBaru();
    const asli = await setor(app, { customerId: k.nasabah, adminId: k.admin, clientRequestId: uSetor, items });
    // tipe lain
    await expectDbError(
      tarik(app, { customerId: k.nasabah, adminId: k.admin, clientRequestId: uSetor, jumlah: 1 }),
      "VALIDASI_GAGAL",
    );
    // customer lain
    await expectDbError(
      setor(app, { customerId: nasabahLain, adminId: k.admin, clientRequestId: uSetor, items }),
      "VALIDASI_GAGAL",
    );
    // admin lain
    await expectDbError(
      setor(app, { customerId: k.nasabah, adminId: adminLain, clientRequestId: uSetor, items }),
      "VALIDASI_GAGAL",
    );

    const uTarik = uuidBaru();
    const t1 = await tarik(app, { customerId: k.nasabah, adminId: k.admin, clientRequestId: uTarik, jumlah: 100 });
    await expectDbError(
      tarik(app, { customerId: nasabahLain, adminId: k.admin, clientRequestId: uTarik, jumlah: 100 }),
      "VALIDASI_GAGAL",
    );
    await expectDbError(koreksi(app, { originalId: t1.transactionId, adminId: k.superAdmin, clientRequestId: uTarik }), "VALIDASI_GAGAL");

    const uKor = uuidBaru();
    await koreksi(app, { originalId: t1.transactionId, adminId: k.superAdmin, clientRequestId: uKor });
    // reverses_id lain
    await expectDbError(koreksi(app, { originalId: asli.transactionId, adminId: k.superAdmin, clientRequestId: uKor }), "VALIDASI_GAGAL");
    // super_admin lain
    await expectDbError(koreksi(app, { originalId: t1.transactionId, adminId: superLain, clientRequestId: uKor }), "VALIDASI_GAGAL");

    for (const u of [uSetor, uTarik, uKor]) expect(await barisDenganUuid(u)).toBe(1);
  });

  it("admin yang sudah nonaktif lalu retry -> duplikat=true", async () => {
    const k = await buatKonteks(owner);
    const u = uuidBaru();
    const items = itemsJson([{ wasteTypeId: k.jenis100, berat: "10.00" }]);
    const asli = await setor(app, { customerId: k.nasabah, adminId: k.admin, clientRequestId: u, items });
    await setAktif(owner, k.admin, false);
    expect(await setor(app, { customerId: k.nasabah, adminId: k.admin, clientRequestId: u, items })).toEqual({
      ...asli,
      duplikat: true,
    });
    // Request BARU dari admin nonaktif tetap ditolak.
    await expectDbError(setor(app, { customerId: k.nasabah, adminId: k.admin, items }), "TIDAK_DIIZINKAN");
  });

  const kasusParalel: {
    nama: string;
    siapkan: (k: Awaited<ReturnType<typeof buatKonteks>>) => Promise<(tx: Db) => Promise<Hasil>>;
    saldoAkhir: bigint;
  }[] = [
    {
      nama: "setor",
      siapkan: async (k) => {
        const u = uuidBaru();
        const hash = hashBaru();
        const items = itemsJson([{ wasteTypeId: k.jenis100, berat: "7.00" }]);
        return (tx) => setor(tx, { customerId: k.nasabah, adminId: k.admin, clientRequestId: u, items, hashFoto: hash });
      },
      saldoAkhir: 700n,
    },
    {
      nama: "tarik",
      siapkan: async (k) => {
        await isiSaldo(app, k, 1_000);
        const u = uuidBaru();
        // Jumlah = seluruh saldo: request kedua TIDAK boleh berakhir SALDO_TIDAK_CUKUP.
        return (tx) => tarik(tx, { customerId: k.nasabah, adminId: k.admin, clientRequestId: u, jumlah: 1_000 });
      },
      saldoAkhir: 0n,
    },
    {
      nama: "koreksi",
      siapkan: async (k) => {
        const asli = await isiSaldo(app, k, 1_000);
        const u = uuidBaru();
        return (tx) => koreksi(tx, { originalId: asli, adminId: k.superAdmin, clientRequestId: u });
      },
      saldoAkhir: 0n,
    },
  ];

  for (const kasus of kasusParalel) {
    it(`request PARALEL dengan UUID sama (${kasus.nama}) -> satu baris, satu duplikat=false, satu duplikat=true (x${ITERASI})`, async () => {
      for (let i = 0; i < ITERASI; i++) {
        const k = await buatKonteks(owner);
        const panggil = await kasus.siapkan(k);
        const barisAwal = await jumlahBaris(owner, k.nasabah);
        const rs = await paralel(clients, [panggil, panggil]);
        const ok = sukses(rs);
        expect(ok, `iterasi ${i}: semua sukses tanpa error`).toHaveLength(2);
        expect(ok.map((h) => h.duplikat).sort()).toEqual([false, true]);
        expect(ok[0].transactionId).toBe(ok[1].transactionId);
        expect(ok[0].saldoBaru).toBe(kasus.saldoAkhir.toString());
        expect(ok[1].saldoBaru).toBe(kasus.saldoAkhir.toString());
        expect(await jumlahBaris(owner, k.nasabah)).toBe(barisAwal + 1);
        expect(await saldo(owner, k.nasabah)).toBe(kasus.saldoAkhir);
      }
    });
  }
});
