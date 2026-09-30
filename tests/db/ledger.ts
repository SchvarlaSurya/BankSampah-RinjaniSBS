import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import type { Db, Sql } from "./clients";

/** Hasil setor/tarik/koreksi yang sudah dinormalkan (id & saldo bigint tetap string). */
export interface Hasil {
  transactionId: string;
  saldoBaru: string;
  duplikat: boolean;
}

function normalisasi(rows: readonly Record<string, unknown>[]): Hasil {
  expect(rows).toHaveLength(1);
  const { transaction_id, saldo_baru, duplikat } = rows[0];
  // postgres.js mengembalikan int8 sebagai string; jangan Number() karena bisa melewati 2^53.
  if (typeof transaction_id !== "string" || !/^\d+$/.test(transaction_id)) {
    throw new Error(`transaction_id tidak valid: ${String(transaction_id)}`);
  }
  if (typeof saldo_baru !== "string" || !/^-?\d+$/.test(saldo_baru)) {
    throw new Error(`saldo_baru tidak valid: ${String(saldo_baru)}`);
  }
  if (typeof duplikat !== "boolean") throw new Error(`duplikat tidak valid: ${String(duplikat)}`);
  return { transactionId: transaction_id, saldoBaru: saldo_baru, duplikat };
}

export interface SetorArgs {
  customerId: string;
  adminId: string;
  clientRequestId?: string;
  /** JSON mentah p_items, lihat itemsJson(). Mentah supaya bisa mengirim input yang salah.
   *  Dikirim ::text lalu di-cast: kalau parameternya bertipe jsonb, postgres.js meng-JSON.stringify string ini. */
  items: string;
  pathFoto?: string;
  hashFoto?: string;
  catatan?: string | null;
}

export async function setor(db: Db, a: SetorArgs): Promise<Hasil> {
  const rows = await db`
    select * from public.setor(
      ${a.customerId}, ${a.adminId}, ${a.clientRequestId ?? randomUUID()}::uuid,
      ${a.items}::text::jsonb, ${a.pathFoto ?? "nasabah/foto.jpg"}, ${a.hashFoto ?? hashBaru()}, ${a.catatan ?? null}
    )`;
  return normalisasi(rows);
}

export interface TarikArgs {
  customerId: string;
  adminId: string;
  clientRequestId?: string;
  jumlah: number | bigint;
  catatan?: string | null;
}

export async function tarik(db: Db, a: TarikArgs): Promise<Hasil> {
  const rows = await db`
    select * from public.tarik(
      ${a.customerId}, ${a.adminId}, ${a.clientRequestId ?? randomUUID()}::uuid,
      ${String(a.jumlah)}::integer, ${a.catatan ?? null}
    )`;
  return normalisasi(rows);
}

export interface KoreksiArgs {
  originalId: string;
  adminId: string;
  clientRequestId?: string;
  alasan?: string;
}

export async function koreksi(db: Db, a: KoreksiArgs): Promise<Hasil> {
  const rows = await db`
    select * from public.koreksi(
      ${a.originalId}::bigint, ${a.adminId}, ${a.clientRequestId ?? randomUUID()}::uuid,
      ${a.alasan ?? "salah input"}
    )`;
  return normalisasi(rows);
}

/** round(berat * harga) untuk nilai positif, dihitung dengan bigint (berat dalam sentikilogram). */
export function subtotal(berat: string, harga: number | bigint): bigint {
  const [bulat, desimal = ""] = berat.split(".");
  const centi = BigInt(bulat) * 100n + BigInt((desimal + "00").slice(0, 2));
  return (centi * BigInt(harga) + 50n) / 100n;
}

export const hashBaru = () => `sha256-${randomUUID()}`;
export const uuidBaru = () => randomUUID();

/** Rupiah -> berat "x.yy" untuk jenis sampah seharga Rp100/kg (subtotal = rupiah, tanpa float). */
export function beratUntukRupiah(rupiah: number): string {
  return `${Math.floor(rupiah / 100)}.${String(rupiah % 100).padStart(2, "0")}`;
}

/** p_items sebagai teks JSON. berat disisipkan mentah sebagai angka JSON ("2.50" -> 2.50). */
export function itemsJson(list: { wasteTypeId: string; berat: string }[]): string {
  return `[${list.map((i) => `{"waste_type_id":${i.wasteTypeId},"berat":${i.berat}}`).join(",")}]`;
}

/** Saldo dari ledger (SUM) dan dari view; keduanya harus sama. */
export async function saldo(owner: Sql, customerId: string): Promise<bigint> {
  const [ledger] = await owner`
    select coalesce(sum(jumlah), 0)::text as s from public.transactions where customer_id = ${customerId}`;
  const [view] = await owner`
    select coalesce((select saldo from public.saldo_nasabah where customer_id = ${customerId}), 0)::text as s`;
  expect(view.s).toBe(ledger.s);
  return BigInt(ledger.s);
}

export async function jumlahBaris(owner: Sql, customerId: string): Promise<number> {
  const [r] = await owner`select count(*)::int as n from public.transactions where customer_id = ${customerId}`;
  return r.n;
}

/**
 * Jalankan beberapa pemanggilan secara PARALEL, masing-masing di koneksi & transaksi sendiri.
 * Setelah fungsi selesai, transaksi ditahan `tahanMs` sebelum COMMIT. Ini melebarkan jendela
 * race (seperti server action yang masih bekerja sebelum commit) sehingga tes deterministik:
 * tanpa lock yang benar, pemanggil lain PASTI melihat data basi.
 */
export async function paralel<T>(
  clients: Sql[],
  fns: ((tx: Db) => Promise<T>)[],
  tahanMs = 50,
): Promise<PromiseSettledResult<T>[]> {
  if (fns.length > clients.length) throw new Error("client paralel kurang");
  return Promise.allSettled(
    fns.map((fn, i) =>
      clients[i].begin(async (tx) => {
        const r = await fn(tx);
        await tx`select pg_sleep(${String(tahanMs / 1000)}::float8)`;
        return r;
      }) as Promise<T>,
    ),
  );
}

export function sukses<T>(rs: PromiseSettledResult<T>[]): T[] {
  return rs.filter((r): r is PromiseFulfilledResult<T> => r.status === "fulfilled").map((r) => r.value);
}

export function gagal<T>(rs: PromiseSettledResult<T>[]): unknown[] {
  return rs.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => r.reason);
}
