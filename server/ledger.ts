import "server-only";
import type { SQL } from "drizzle-orm";
import { keNumberAman } from "./angka";
import { db } from "./db";

export interface HasilLedger {
  transactionId: string;
  saldoBaru: number;
  duplikat: boolean;
}

/**
 * Jalankan setor/tarik/koreksi (fungsi SQL, autocommit = READ COMMITTED). saldo_baru (bigint,
 * string dari driver) menjadi number hanya bila aman; selain itu melempar -> SERVER_ERROR + log.
 */
export async function panggilLedger(query: SQL): Promise<HasilLedger> {
  const rows = await db.execute<{ transaction_id: string; saldo_baru: string; duplikat: boolean }>(query);
  if (rows.length !== 1) throw new Error(`fungsi ledger mengembalikan ${rows.length} baris`);
  const r = rows[0];
  return {
    transactionId: String(r.transaction_id),
    saldoBaru: keNumberAman(r.saldo_baru, "saldo_baru"),
    duplikat: r.duplikat,
  };
}

/**
 * p_items untuk fungsi setor. berat sudah lolos zod kontrak (maks 5 digit + 2 desimal), jadi
 * Number(berat) tepat dan JSON.stringify menuliskannya tanpa notasi ilmiah (diuji untuk semua
 * 0.01..10000.00). null bila id jenis sampah di luar batas aman number (pasti tidak ada).
 */
export function itemsKeJson(items: { wasteTypeId: string; berat: string }[]): string | null {
  const hasil: { waste_type_id: number; berat: number }[] = [];
  for (const i of items) {
    const id = Number(i.wasteTypeId);
    if (!Number.isSafeInteger(id)) return null;
    hasil.push({ waste_type_id: id, berat: Number(i.berat) });
  }
  return JSON.stringify(hasil);
}
