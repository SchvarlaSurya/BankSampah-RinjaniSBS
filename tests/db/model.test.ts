import { describe, expect, it } from "vitest";
import { bukaKoneksi } from "./clients";
import { type DbErrorCode, pgErrorDari } from "./errors";
import { buatJenis, buatUser } from "./factories";
import { type Hasil, hashBaru, itemsJson, koreksi, saldo, setor, subtotal, tarik, uuidBaru } from "./ledger";

const { owner, app } = bukaKoneksi();

const SEED = 20260930;
const JUMLAH_OPERASI = 300;

/** PRNG deterministik (mulberry32): seed yang sama = urutan operasi yang sama. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Hasilnya = { ok: Hasil } | { kode: string };

async function coba(p: Promise<Hasil>): Promise<Hasilnya> {
  try {
    return { ok: await p };
  } catch (e) {
    return { kode: pgErrorDari(e).message };
  }
}

interface TrxModel {
  tipe: "setor" | "tarik" | "koreksi";
  customer: string;
  jumlah: bigint;
  dibalik: boolean;
  hash?: string;
}

/** Request yang pernah sukses; dipakai ulang untuk retry dengan client_request_id yang sama. */
type Request =
  | { jenis: "setor"; id: string; customer: string; admin: string; uuid: string; items: string; hash: string }
  | { jenis: "tarik"; id: string; customer: string; admin: string; uuid: string; jumlah: bigint }
  | { jenis: "koreksi"; id: string; customer: string; admin: string; uuid: string; original: string };

describe("J. berbasis model", () => {
  it(`${JUMLAH_OPERASI} operasi acak (seed ${SEED}) cocok dengan model bigint`, async () => {
    console.log(`[J] seed=${SEED} operasi=${JUMLAH_OPERASI}`);
    const r = mulberry32(SEED);
    const acak = (n: number) => Math.floor(r() * n);
    const pilih = <T>(xs: readonly T[]): T => xs[acak(xs.length)];

    const nasabah = await Promise.all(Array.from({ length: 5 }, () => buatUser(owner, "nasabah")));
    const admin = await buatUser(owner, "admin");
    const superAdmin = await buatUser(owner, "super_admin");
    const staf = [admin, superAdmin];
    // Rp10/kg sengaja ada: berat <= 0.04 kg menghasilkan subtotal 0 (ITEM_TERLALU_KECIL).
    const hargaJenis = [1500, 3000, 777, 10];
    const jenis = await Promise.all(hargaJenis.map((h) => buatJenis(owner, h)));

    const saldoModel = new Map<string, bigint>(nasabah.map((n) => [n, 0n]));
    const trx = new Map<string, TrxModel>();
    const hashAktif = new Map<string, string>(); // hash -> id setor yang belum dibalik
    const semuaHash: string[] = [];
    const riwayat: Request[] = [];
    const statistik: Record<string, number> = {};
    const catat = (k: string) => (statistik[k] = (statistik[k] ?? 0) + 1);

    async function cekLangkah(i: number, harap: { ok: bigint; customer: string; duplikat: boolean; id?: string } | { kode: DbErrorCode }, hasil: Hasilnya) {
      const ctx = `operasi #${i}`;
      if ("kode" in harap) {
        expect(hasil, ctx).toEqual({ kode: harap.kode });
        catat(harap.kode);
        return;
      }
      expect("ok" in hasil, `${ctx}: harus sukses, dapat ${JSON.stringify(hasil)}`).toBe(true);
      const h = (hasil as { ok: Hasil }).ok;
      expect(h.duplikat, ctx).toBe(harap.duplikat);
      if (harap.id) expect(h.transactionId, ctx).toBe(harap.id);
      expect(h.saldoBaru, `${ctx}: saldo_baru`).toBe(harap.ok.toString());
      expect(await saldo(owner, harap.customer), `${ctx}: view saldo_nasabah`).toBe(harap.ok);
      expect(harap.ok >= 0n, `${ctx}: saldo tidak boleh minus`).toBe(true);
    }

    for (let i = 0; i < JUMLAH_OPERASI; i++) {
      const p = r();
      const op = p < 0.35 || trx.size === 0 ? "setor" : p < 0.6 ? "tarik" : p < 0.82 ? "koreksi" : "retry";

      if (op === "setor") {
        const customer = pilih(nasabah);
        const oleh = pilih(staf);
        const list = Array.from({ length: 1 + acak(3) }, () => {
          const idx = acak(jenis.length);
          // Jenis Rp10/kg: 20% berat 0.01-0.04 kg supaya ITEM_TERLALU_KECIL ikut teruji.
          const centi = hargaJenis[idx] === 10 && r() < 0.2 ? 1 + acak(4) : 1 + acak(5000);
          return { wasteTypeId: jenis[idx], harga: hargaJenis[idx], berat: `${Math.floor(centi / 100)}.${String(centi % 100).padStart(2, "0")}` };
        });
        const subs = list.map((x) => subtotal(x.berat, x.harga));
        const hash = semuaHash.length > 0 && r() < 0.1 ? pilih(semuaHash) : hashBaru();
        const items = itemsJson(list);
        const uuid = uuidBaru();
        const hasil = await coba(setor(app, { customerId: customer, adminId: oleh, clientRequestId: uuid, items, hashFoto: hash }));

        if (subs.some((s) => s === 0n)) {
          await cekLangkah(i, { kode: "ITEM_TERLALU_KECIL" }, hasil);
        } else if (hashAktif.has(hash)) {
          await cekLangkah(i, { kode: "FOTO_SUDAH_DIPAKAI" }, hasil);
        } else {
          const total = subs.reduce((a, b) => a + b, 0n);
          saldoModel.set(customer, saldoModel.get(customer)! + total);
          await cekLangkah(i, { ok: saldoModel.get(customer)!, customer, duplikat: false }, hasil);
          const id = (hasil as { ok: Hasil }).ok.transactionId;
          expect(trx.has(id), `operasi #${i}: id baru`).toBe(false);
          trx.set(id, { tipe: "setor", customer, jumlah: total, dibalik: false, hash });
          hashAktif.set(hash, id);
          if (!semuaHash.includes(hash)) semuaHash.push(hash);
          riwayat.push({ jenis: "setor", id, customer, admin: oleh, uuid, items, hash });
          catat("setor");
        }
      } else if (op === "tarik") {
        const customer = pilih(nasabah);
        const oleh = pilih(staf);
        const s = saldoModel.get(customer)!;
        const jumlah = s > 0n && r() < 0.7 ? 1n + BigInt(acak(Number(s))) : 1n + BigInt(acak(Number(s) + 5000));
        const uuid = uuidBaru();
        const hasil = await coba(tarik(app, { customerId: customer, adminId: oleh, clientRequestId: uuid, jumlah }));
        if (jumlah > s) {
          await cekLangkah(i, { kode: "SALDO_TIDAK_CUKUP" }, hasil);
        } else {
          saldoModel.set(customer, s - jumlah);
          await cekLangkah(i, { ok: s - jumlah, customer, duplikat: false }, hasil);
          const id = (hasil as { ok: Hasil }).ok.transactionId;
          trx.set(id, { tipe: "tarik", customer, jumlah: -jumlah, dibalik: false });
          riwayat.push({ jenis: "tarik", id, customer, admin: oleh, uuid, jumlah });
          catat("tarik");
        }
      } else if (op === "koreksi") {
        const oleh = r() < 0.8 ? superAdmin : admin;
        const tidakAda = r() < 0.05;
        const original = tidakAda ? "900000000000" : pilih([...trx.keys()]);
        const uuid = uuidBaru();
        const hasil = await coba(koreksi(app, { originalId: original, adminId: oleh, clientRequestId: uuid }));
        const t = trx.get(original);

        if (oleh !== superAdmin) await cekLangkah(i, { kode: "TIDAK_DIIZINKAN" }, hasil);
        else if (!t) await cekLangkah(i, { kode: "TRANSAKSI_TIDAK_DITEMUKAN" }, hasil);
        else if (t.tipe === "koreksi") await cekLangkah(i, { kode: "TRANSAKSI_TIDAK_BISA_DIBALIK" }, hasil);
        else if (t.dibalik) await cekLangkah(i, { kode: "TRANSAKSI_SUDAH_DIBALIK" }, hasil);
        else if (saldoModel.get(t.customer)! - t.jumlah < 0n) await cekLangkah(i, { kode: "KOREKSI_MEMBUAT_SALDO_MINUS" }, hasil);
        else {
          const baru = saldoModel.get(t.customer)! - t.jumlah;
          saldoModel.set(t.customer, baru);
          await cekLangkah(i, { ok: baru, customer: t.customer, duplikat: false }, hasil);
          const id = (hasil as { ok: Hasil }).ok.transactionId;
          t.dibalik = true;
          if (t.hash) hashAktif.delete(t.hash);
          trx.set(id, { tipe: "koreksi", customer: t.customer, jumlah: -t.jumlah, dibalik: false });
          riwayat.push({ jenis: "koreksi", id, customer: t.customer, admin: oleh, uuid, original });
          catat("koreksi");
        }
      } else {
        // Retry request lama dengan UUID sama; kadang dengan payload berbeda.
        const q = pilih(riwayat);
        const ubah = r() < 0.5;
        let p2: Promise<Hasil>;
        if (q.jenis === "setor") {
          p2 = setor(app, {
            customerId: q.customer,
            adminId: q.admin,
            clientRequestId: q.uuid,
            items: ubah ? itemsJson([{ wasteTypeId: jenis[0], berat: "1.00" }]) : q.items,
            hashFoto: ubah ? hashBaru() : q.hash,
          });
        } else if (q.jenis === "tarik") {
          p2 = tarik(app, { customerId: q.customer, adminId: q.admin, clientRequestId: q.uuid, jumlah: ubah ? q.jumlah + 7n : q.jumlah });
        } else {
          p2 = koreksi(app, { originalId: q.original, adminId: q.admin, clientRequestId: q.uuid, alasan: ubah ? "alasan lain" : undefined });
        }
        await cekLangkah(i, { ok: saldoModel.get(q.customer)!, customer: q.customer, duplikat: true, id: q.id }, await coba(p2));
        catat(`retry_${q.jenis}`);
      }
    }

    // Akhir: SUM(jumlah) per nasabah & jumlah baris sama dengan model; tidak ada yang minus.
    for (const n of nasabah) {
      expect(await saldo(owner, n), `saldo akhir ${n}`).toBe(saldoModel.get(n));
      expect(saldoModel.get(n)! >= 0n).toBe(true);
      const [c] = await owner`select count(*)::int as n from public.transactions where customer_id = ${n}`;
      expect(c.n).toBe([...trx.values()].filter((t) => t.customer === n).length);
    }
    const [minus] = await owner`
      select count(*)::int as n from public.saldo_nasabah where customer_id = any(${nasabah}) and saldo < 0`;
    expect(minus.n).toBe(0);

    console.log(`[J] statistik ${JSON.stringify(statistik)}`);
    console.log(`[J] saldo akhir ${JSON.stringify(Object.fromEntries([...saldoModel.values()].map((v, i) => [`nasabah${i + 1}`, v.toString()])))}`);
  });
});
