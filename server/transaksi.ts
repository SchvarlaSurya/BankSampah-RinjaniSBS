import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ItemTransaksi, TransaksiDetail } from "@/contract";
import { idKeNumber } from "./angka";
import { db } from "./db";
import { user } from "./db/auth-schema";
import { transactionItems, transactions, wasteTypes } from "./db/schema";
import { fotoStorage, UMUR_URL_FOTO_DETIK } from "./foto/storage";
import type { SesiServer } from "./guards";

const pelanggan = alias(user, "pelanggan");
const pembuat = alias(user, "pembuat");

/**
 * Referensi ke baris luar untuk subquery berkorelasi. Ditulis lengkap ("transactions"."id")
 * dengan sengaja: pada select satu tabel drizzle merender ${transactions.id} sebagai "id"
 * saja, yang di dalam subquery akan terbaca sebagai kolom tabel subquery itu sendiri.
 */
const idLuar = sql.raw(`"transactions"."id"`);
const dibuatOlehLuar = sql.raw(`"transactions"."dibuat_oleh"`);

/** true bila sudah ada koreksi yang membalik transaksi ini. */
export const sudahDibalikSql = sql<boolean>`exists (select 1 from public.transactions k where k.reverses_id = ${idLuar})`;

/** Nama pembuat transaksi baris luar. */
export const namaPembuatSql = sql<string>`(select u.name from public."user" u where u.id = ${dibuatOlehLuar})`;

/**
 * SATU-SATUNYA pembentuk TransaksiDetail: dipakai getTransaksi, hasil setor/tarik/koreksi
 * (MutasiResult.transaksi) dan auditTransaksi. Urutan hasil mengikuti `ids`.
 * fotoUrl hanya untuk super_admin & transaksi setor.
 */
export async function muatTransaksiDetail(ids: string[], sesi: SesiServer): Promise<TransaksiDetail[]> {
  const angka = ids.map(idKeNumber).filter((n): n is number => n !== null);
  if (angka.length === 0) return [];

  const baris = await db
    .select({
      id: sql<string>`${transactions.id}::text`,
      tipe: transactions.tipe,
      jumlah: transactions.jumlah,
      waktu: transactions.waktu,
      catatan: transactions.catatan,
      membalikId: sql<string | null>`${transactions.reversesId}::text`,
      pathFoto: transactions.pathFoto,
      customerId: transactions.customerId,
      customerNama: pelanggan.name,
      customerUsername: pelanggan.username,
      dibuatOlehId: transactions.dibuatOleh,
      dibuatOlehNama: pembuat.name,
      dibalikOlehId: sql<string | null>`(select k.id::text from public.transactions k where k.reverses_id = ${idLuar})`,
    })
    .from(transactions)
    .innerJoin(pelanggan, eq(pelanggan.id, transactions.customerId))
    .innerJoin(pembuat, eq(pembuat.id, transactions.dibuatOleh))
    .where(inArray(transactions.id, angka));

  const items = await db
    .select({
      transactionId: sql<string>`${transactionItems.transactionId}::text`,
      wasteTypeId: sql<string>`${transactionItems.wasteTypeId}::text`,
      namaSampah: wasteTypes.nama,
      berat: transactionItems.berat,
      hargaSnapshot: transactionItems.hargaSnapshot,
      subtotal: transactionItems.subtotal,
    })
    .from(transactionItems)
    .innerJoin(wasteTypes, eq(wasteTypes.id, transactionItems.wasteTypeId))
    .where(inArray(transactionItems.transactionId, angka))
    .orderBy(asc(transactionItems.id));

  const itemPer = new Map<string, ItemTransaksi[]>();
  for (const { transactionId, ...item } of items) {
    itemPer.set(transactionId, [...(itemPer.get(transactionId) ?? []), item]);
  }

  const lihatFoto = sesi.role === "super_admin";
  const perId = new Map<string, TransaksiDetail>();
  for (const b of baris) {
    let fotoUrl: string | null = null;
    let fotoUrlBerlakuHingga: string | null = null;
    if (lihatFoto && b.tipe === "setor" && b.pathFoto) {
      const u = await fotoStorage().urlBertandatangan(b.pathFoto, UMUR_URL_FOTO_DETIK);
      fotoUrl = u.url;
      fotoUrlBerlakuHingga = u.berlakuHingga.toISOString();
    }
    perId.set(b.id, {
      id: b.id,
      tipe: b.tipe,
      jumlah: b.jumlah,
      waktu: b.waktu.toISOString(),
      catatan: b.catatan,
      dibuatOlehNama: b.dibuatOlehNama,
      sudahDibalik: b.dibalikOlehId !== null,
      membalikId: b.membalikId,
      customerId: b.customerId,
      customerNama: b.customerNama,
      customerUsername: b.customerUsername ?? "",
      dibuatOlehId: b.dibuatOlehId,
      items: itemPer.get(b.id) ?? [],
      dibalikOlehId: b.dibalikOlehId,
      fotoUrl,
      fotoUrlBerlakuHingga,
    });
  }
  return ids.map((id) => perId.get(id)).filter((d): d is TransaksiDetail => d !== undefined);
}
