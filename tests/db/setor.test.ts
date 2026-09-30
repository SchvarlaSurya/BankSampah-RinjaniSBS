import { describe, expect, it } from "vitest";
import { bukaKoneksi } from "./clients";
import { expectDbError, pgErrorDari } from "./errors";
import { buatJenis, buatKonteks, buatUser, setAktif } from "./factories";
import { gagal, hashBaru, itemsJson, koreksi, paralel, saldo, setor, subtotal, sukses } from "./ledger";

const { owner, app, paralel: clients } = bukaKoneksi();
const ITERASI = 25;

describe("A. setor", () => {
  it("benar: saldo = jumlah, subtotal = round(berat*harga), harga dari waste_types", async () => {
    const k = await buatKonteks(owner);
    const plastik = await buatJenis(owner, 3000);
    const kardus = await buatJenis(owner, 1234);
    const items = [
      { wasteTypeId: plastik, berat: "2.50", harga: 3000 },
      { wasteTypeId: kardus, berat: "1.37", harga: 1234 }, // 1690.58 -> 1691
    ];
    const total = items.reduce((s, i) => s + subtotal(i.berat, i.harga), 0n);
    expect(total).toBe(7500n + 1691n);

    const h = await setor(app, { customerId: k.nasabah, adminId: k.admin, items: itemsJson(items) });
    expect(h.duplikat).toBe(false);
    expect(h.saldoBaru).toBe(total.toString());
    expect(await saldo(owner, k.nasabah)).toBe(total);

    const [trx] = await owner`
      select tipe, jumlah::text, customer_id, dibuat_oleh from public.transactions where id = ${h.transactionId}`;
    expect(trx).toEqual({ tipe: "setor", jumlah: total.toString(), customer_id: k.nasabah, dibuat_oleh: k.admin });

    const rows = await owner`
      select waste_type_id::text, berat::text, harga_snapshot, subtotal
      from public.transaction_items where transaction_id = ${h.transactionId} order by id`;
    expect(rows.map((r) => ({ ...r }))).toEqual(
      items.map((i) => ({
        waste_type_id: i.wasteTypeId,
        berat: i.berat,
        harga_snapshot: i.harga,
        subtotal: Number(subtotal(i.berat, i.harga)),
      })),
    );
  });

  it("harga_snapshot tidak berubah setelah harga waste_types diubah", async () => {
    const k = await buatKonteks(owner);
    const jenis = await buatJenis(owner, 2000);
    const h = await setor(app, {
      customerId: k.nasabah,
      adminId: k.admin,
      items: itemsJson([{ wasteTypeId: jenis, berat: "3.00" }]),
    });
    await app`update public.waste_types set harga_beli = 9999 where id = ${jenis}`;

    const [item] = await owner`
      select harga_snapshot, subtotal from public.transaction_items where transaction_id = ${h.transactionId}`;
    expect({ ...item }).toEqual({ harga_snapshot: 2000, subtotal: 6000 });
    expect(await saldo(owner, k.nasabah)).toBe(6000n);

    // Setor berikutnya memakai harga baru.
    const h2 = await setor(app, {
      customerId: k.nasabah,
      adminId: k.admin,
      items: itemsJson([{ wasteTypeId: jenis, berat: "1.00" }]),
    });
    expect(h2.saldoBaru).toBe(String(6000 + 9999));
  });

  it("nasabah nonaktif -> NASABAH_NONAKTIF", async () => {
    const k = await buatKonteks(owner);
    await setAktif(owner, k.nasabah, false);
    const items = itemsJson([{ wasteTypeId: k.jenis100, berat: "1.00" }]);
    await expectDbError(setor(app, { customerId: k.nasabah, adminId: k.admin, items }), "NASABAH_NONAKTIF");
  });

  it("customer tidak ada atau role bukan nasabah -> NASABAH_TIDAK_DITEMUKAN", async () => {
    const k = await buatKonteks(owner);
    const items = itemsJson([{ wasteTypeId: k.jenis100, berat: "1.00" }]);
    await expectDbError(
      setor(app, { customerId: "tidak-ada", adminId: k.admin, items }),
      "NASABAH_TIDAK_DITEMUKAN",
    );
    await expectDbError(setor(app, { customerId: k.admin, adminId: k.admin, items }), "NASABAH_TIDAK_DITEMUKAN");
  });

  it("jenis sampah nonaktif / tidak ada -> JENIS_SAMPAH_TIDAK_VALID", async () => {
    const k = await buatKonteks(owner);
    const nonaktif = await buatJenis(owner, 500, { aktif: false });
    await expectDbError(
      setor(app, {
        customerId: k.nasabah,
        adminId: k.admin,
        items: itemsJson([{ wasteTypeId: nonaktif, berat: "1.00" }]),
      }),
      "JENIS_SAMPAH_TIDAK_VALID",
    );
    await expectDbError(
      setor(app, {
        customerId: k.nasabah,
        adminId: k.admin,
        items: itemsJson([{ wasteTypeId: "900000000000", berat: "1.00" }]),
      }),
      "JENIS_SAMPAH_TIDAK_VALID",
    );
  });

  it("subtotal Rp0 -> ITEM_TERLALU_KECIL", async () => {
    const k = await buatKonteks(owner);
    const murah = await buatJenis(owner, 10); // 0.01 kg x Rp10 = Rp0.1 -> 0
    await expectDbError(
      setor(app, {
        customerId: k.nasabah,
        adminId: k.admin,
        items: itemsJson([
          { wasteTypeId: k.jenis100, berat: "1.00" },
          { wasteTypeId: murah, berat: "0.01" },
        ]),
      }),
      "ITEM_TERLALU_KECIL",
    );
    expect(await saldo(owner, k.nasabah)).toBe(0n);
  });

  it("berat string / 3 desimal / 0 / negatif -> VALIDASI_GAGAL", async () => {
    const k = await buatKonteks(owner);
    for (const berat of ['"2.5"', "1.234", "0", "0.00", "-1"]) {
      await expectDbError(
        setor(app, {
          customerId: k.nasabah,
          adminId: k.admin,
          items: itemsJson([{ wasteTypeId: k.jenis100, berat }]),
        }),
        "VALIDASI_GAGAL",
      );
    }
    for (const items of ["[]", "{}", "null", '[{"waste_type_id":"1","berat":1}]']) {
      await expectDbError(setor(app, { customerId: k.nasabah, adminId: k.admin, items }), "VALIDASI_GAGAL");
    }
    expect(await saldo(owner, k.nasabah)).toBe(0n);
  });

  it("admin ber-role nasabah -> TIDAK_DIIZINKAN", async () => {
    const k = await buatKonteks(owner);
    const nasabahLain = await buatUser(owner, "nasabah");
    const items = itemsJson([{ wasteTypeId: k.jenis100, berat: "1.00" }]);
    await expectDbError(setor(app, { customerId: k.nasabah, adminId: nasabahLain, items }), "TIDAK_DIIZINKAN");
    await expectDbError(setor(app, { customerId: k.nasabah, adminId: "tidak-ada", items }), "TIDAK_DIIZINKAN");
  });
});

describe("B. hash foto", () => {
  it("hash yang masih aktif ditolak; setelah transaksinya dikoreksi diterima lagi", async () => {
    const k = await buatKonteks(owner);
    const hash = hashBaru();
    const items = itemsJson([{ wasteTypeId: k.jenis100, berat: "10.00" }]);

    const asli = await setor(app, { customerId: k.nasabah, adminId: k.admin, items, hashFoto: hash });
    await expectDbError(
      setor(app, { customerId: k.nasabah, adminId: k.admin, items, hashFoto: hash }),
      "FOTO_SUDAH_DIPAKAI",
    );
    // Nasabah lain pun tidak boleh memakai foto yang sama.
    const lain = await buatUser(owner, "nasabah");
    await expectDbError(setor(app, { customerId: lain, adminId: k.admin, items, hashFoto: hash }), "FOTO_SUDAH_DIPAKAI");

    await koreksi(app, { originalId: asli.transactionId, adminId: k.superAdmin, alasan: "salah nasabah" });
    const ulang = await setor(app, { customerId: lain, adminId: k.admin, items, hashFoto: hash });
    expect(ulang.duplikat).toBe(false);
    expect(ulang.saldoBaru).toBe("1000");

    // Sekarang hash aktif lagi (milik transaksi baru).
    await expectDbError(
      setor(app, { customerId: k.nasabah, adminId: k.admin, items, hashFoto: hash }),
      "FOTO_SUDAH_DIPAKAI",
    );
  });

  it(`dua setor PARALEL, UUID beda, hash sama -> tepat satu sukses (x${ITERASI})`, async () => {
    for (let i = 0; i < ITERASI; i++) {
      const k = await buatKonteks(owner);
      const hash = hashBaru();
      const items = itemsJson([{ wasteTypeId: k.jenis100, berat: "5.00" }]);
      const rs = await paralel(clients, [
        (tx) => setor(tx, { customerId: k.nasabah, adminId: k.admin, items, hashFoto: hash }),
        (tx) => setor(tx, { customerId: k.nasabah, adminId: k.admin, items, hashFoto: hash }),
      ]);
      expect(sukses(rs)).toHaveLength(1);
      expect(sukses(rs)[0].duplikat).toBe(false);
      const [e] = gagal(rs);
      expect(pgErrorDari(e).message).toBe("FOTO_SUDAH_DIPAKAI");
      expect(await saldo(owner, k.nasabah)).toBe(500n);
    }
  });
});
