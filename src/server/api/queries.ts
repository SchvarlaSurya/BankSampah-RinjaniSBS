"use server";

import { eq, and, sql, desc, lt, gte, lte, ilike, or, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  user as userTable,
  transactions as transactionsTable,
  transactionItems as transactionItemsTable,
  wasteTypes as wasteTypesTable,
} from "@/server/db/schema";
import type {
  NasabahRingkas,
  PenggunaRingkas,
  JenisSampah,
  TransaksiRingkas,
  TransaksiDetail,
  ItemTransaksi,
  Halaman,
  UserId,
  TipeTransaksi,
  CariNasabahInput,
  GetNasabahInput,
  HistoriInput,
  GetTransaksiInput,
  AuditInput,
  ActionResult,
  SesiInfo,
} from "@/src/contract";
import { ok, fail, normalisasiBerat } from "@/src/contract";
import { getSesi as fetchSesi } from "./_session";

async function hitungSaldo(customerId: string): Promise<number> {
  const [res] = await db
    .select({
      saldo: sql<number>`coalesce(sum(${transactionsTable.jumlah}), 0)::int`,
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.customerId, customerId));
  return res?.saldo ?? 0;
}

export async function getSesi(): Promise<SesiInfo | null> {
  return fetchSesi();
}

export async function getProfilSaya(): Promise<ActionResult<NasabahRingkas>> {
  const sesi = await fetchSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role !== "nasabah") return fail("TIDAK_DIIZINKAN");

  const [nasabah] = await db
    .select()
    .from(userTable)
    .where(and(eq(userTable.id, sesi.userId), eq(userTable.role, "nasabah")))
    .limit(1);

  if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");

  const saldo = await hitungSaldo(nasabah.id);
  const result: NasabahRingkas = {
    id: nasabah.id as UserId,
    username: nasabah.username || nasabah.email,
    nama: nasabah.name,
    aktif: nasabah.aktif,
    saldo,
  };
  return ok(result);
}

export async function cariNasabah({ query }: CariNasabahInput): Promise<ActionResult<NasabahRingkas[]>> {
  const sesi = await fetchSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role === "nasabah") return fail("TIDAK_DIIZINKAN");

  const q = query.trim();
  if (q.length < 2) return fail("VALIDASI_GAGAL");

  const list = await db
    .select()
    .from(userTable)
    .where(
      and(
        eq(userTable.role, "nasabah"),
        or(
          ilike(userTable.username, `${q}%`),
          ilike(userTable.name, `%${q}%`)
        )
      )
    )
    .limit(20);

  const hasil: NasabahRingkas[] = await Promise.all(
    list.map(async (u) => ({
      id: u.id as UserId,
      username: u.username || u.email,
      nama: u.name,
      aktif: u.aktif,
      saldo: await hitungSaldo(u.id),
    }))
  );

  return ok(hasil);
}

export async function getNasabah({ customerId }: GetNasabahInput): Promise<ActionResult<NasabahRingkas>> {
  const sesi = await fetchSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role === "nasabah" && sesi.userId !== customerId) {
    return fail("TIDAK_DIIZINKAN");
  }

  const [nasabah] = await db
    .select()
    .from(userTable)
    .where(and(eq(userTable.id, customerId), eq(userTable.role, "nasabah")))
    .limit(1);

  if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");

  const saldo = await hitungSaldo(nasabah.id);
  return ok({
    id: nasabah.id as UserId,
    username: nasabah.username || nasabah.email,
    nama: nasabah.name,
    aktif: nasabah.aktif,
    saldo,
  });
}

export async function listJenisSampah(input?: { termasukNonaktif?: boolean }): Promise<ActionResult<JenisSampah[]>> {
  const sesi = await fetchSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");

  const termasukNonaktif = input?.termasukNonaktif ?? false;
  const whereClause = termasukNonaktif
    ? undefined
    : eq(wasteTypesTable.aktif, true);

  const rows = await db
    .select()
    .from(wasteTypesTable)
    .where(whereClause)
    .orderBy(wasteTypesTable.id);

  const hasil: JenisSampah[] = rows.map((r) => ({
    id: String(r.id),
    nama: r.nama,
    hargaBeli: r.hargaBeli,
    aktif: r.aktif,
  }));

  return ok(hasil);
}

export async function listStaf(): Promise<ActionResult<PenggunaRingkas[]>> {
  const sesi = await fetchSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

  const rows = await db
    .select()
    .from(userTable)
    .where(inArray(userTable.role, ["admin", "super_admin"]))
    .orderBy(userTable.name);

  const staf: PenggunaRingkas[] = rows.map((u) => ({
    id: u.id as UserId,
    username: u.username || u.email,
    nama: u.name,
    role: u.role as any,
    aktif: u.aktif,
  }));

  return ok(staf);
}

export async function getHistori({ customerId, cursor, limit = 20 }: HistoriInput): Promise<ActionResult<Halaman<TransaksiRingkas>>> {
  const sesi = await fetchSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role === "nasabah" && sesi.userId !== customerId) {
    return fail("TIDAK_DIIZINKAN");
  }

  const [nasabah] = await db
    .select()
    .from(userTable)
    .where(and(eq(userTable.id, customerId), eq(userTable.role, "nasabah")))
    .limit(1);
  if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");

  const conditions = [eq(transactionsTable.customerId, customerId)];
  if (cursor) {
    conditions.push(lt(transactionsTable.id, Number(cursor)));
  }

  const rows = await db
    .select({
      tx: transactionsTable,
      pembuatNama: userTable.name,
    })
    .from(transactionsTable)
    .innerJoin(userTable, eq(transactionsTable.dibuatOleh, userTable.id))
    .where(and(...conditions))
    .orderBy(desc(transactionsTable.id))
    .limit(limit + 1);

  const hasNext = rows.length > limit;
  const pageItems = hasNext ? rows.slice(0, limit) : rows;
  const nextCursor = hasNext
    ? String(pageItems[pageItems.length - 1].tx.id)
    : null;

  const txIds = pageItems.map((r) => r.tx.id);
  const koreksiMap = new Set<number>();
  if (txIds.length > 0) {
    const reversed = await db
      .select({ reversesId: transactionsTable.reversesId })
      .from(transactionsTable)
      .where(inArray(transactionsTable.reversesId, txIds));
    for (const r of reversed) {
      if (r.reversesId !== null) koreksiMap.add(r.reversesId);
    }
  }

  const ringkas: TransaksiRingkas[] = pageItems.map(({ tx, pembuatNama }) => ({
    id: String(tx.id),
    tipe: tx.tipe as TipeTransaksi,
    jumlah: tx.jumlah,
    waktu: tx.waktu.toISOString(),
    catatan: tx.catatan,
    dibuatOlehNama: pembuatNama,
    sudahDibalik: koreksiMap.has(tx.id),
    membalikId: tx.reversesId ? String(tx.reversesId) : null,
  }));

  return ok({ items: ringkas, nextCursor });
}

export async function getTransaksi({ id }: GetTransaksiInput): Promise<ActionResult<TransaksiDetail>> {
  const sesi = await fetchSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");

  const txIdNum = Number(id);
  if (isNaN(txIdNum)) return fail("TRANSAKSI_TIDAK_DITEMUKAN");

  const [txRow] = await db
    .select({
      tx: transactionsTable,
      customerNama: sql<string>`cust.name`,
      customerUsername: sql<string>`coalesce(cust.username, cust.email)`,
      dibuatOlehNama: sql<string>`creator.name`,
    })
    .from(transactionsTable)
    .innerJoin(
      sql`${userTable} cust`,
      sql`${transactionsTable.customerId} = cust.id`
    )
    .innerJoin(
      sql`${userTable} creator`,
      sql`${transactionsTable.dibuatOleh} = creator.id`
    )
    .where(eq(transactionsTable.id, txIdNum))
    .limit(1);

  if (!txRow) return fail("TRANSAKSI_TIDAK_DITEMUKAN");
  const tx = txRow.tx;

  if (sesi.role === "nasabah" && sesi.userId !== tx.customerId) {
    return fail("TIDAK_DIIZINKAN");
  }

  const itemRows = await db
    .select({
      item: transactionItemsTable,
      wasteNama: wasteTypesTable.nama,
    })
    .from(transactionItemsTable)
    .innerJoin(
      wasteTypesTable,
      eq(transactionItemsTable.wasteTypeId, wasteTypesTable.id)
    )
    .where(eq(transactionItemsTable.transactionId, txIdNum));

  const items: ItemTransaksi[] = itemRows.map(({ item, wasteNama }) => ({
    wasteTypeId: String(item.wasteTypeId),
    namaSampah: wasteNama,
    berat: normalisasiBerat(item.berat),
    hargaSnapshot: item.hargaSnapshot,
    subtotal: item.subtotal,
  }));

  const [koreksiRow] = await db
    .select({ id: transactionsTable.id })
    .from(transactionsTable)
    .where(eq(transactionsTable.reversesId, txIdNum))
    .limit(1);

  const dibalikOlehId = koreksiRow ? String(koreksiRow.id) : null;
  const sudahDibalik = dibalikOlehId !== null;

  const isSuperAdmin = sesi.role === "super_admin";
  const fotoUrl = isSuperAdmin && tx.tipe === "setor" ? tx.pathFoto : null;

  const detail: TransaksiDetail = {
    id: String(tx.id),
    tipe: tx.tipe as TipeTransaksi,
    jumlah: tx.jumlah,
    waktu: tx.waktu.toISOString(),
    catatan: tx.catatan,
    dibuatOlehNama: txRow.dibuatOlehNama,
    sudahDibalik,
    membalikId: tx.reversesId ? String(tx.reversesId) : null,
    customerId: tx.customerId as UserId,
    customerNama: txRow.customerNama,
    customerUsername: txRow.customerUsername,
    dibuatOlehId: tx.dibuatOleh as UserId,
    items,
    dibalikOlehId,
    fotoUrl,
    fotoUrlBerlakuHingga: null,
  };

  return ok(detail);
}

export async function auditTransaksi({ adminId, tipe, dari, sampai, cursor, limit = 20 }: AuditInput): Promise<ActionResult<Halaman<TransaksiDetail>>> {
  const sesi = await fetchSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

  const conditions = [];
  if (adminId) {
    conditions.push(eq(transactionsTable.dibuatOleh, adminId));
  }
  if (tipe) {
    conditions.push(eq(transactionsTable.tipe, tipe));
  }
  if (dari) {
    conditions.push(gte(transactionsTable.waktu, new Date(`${dari}T00:00:00+07:00`)));
  }
  if (sampai) {
    conditions.push(lte(transactionsTable.waktu, new Date(`${sampai}T23:59:59.999+07:00`)));
  }
  if (cursor) {
    conditions.push(lt(transactionsTable.id, Number(cursor)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      tx: transactionsTable,
      customerNama: sql<string>`cust.name`,
      customerUsername: sql<string>`coalesce(cust.username, cust.email)`,
      dibuatOlehNama: sql<string>`creator.name`,
    })
    .from(transactionsTable)
    .innerJoin(
      sql`${userTable} cust`,
      sql`${transactionsTable.customerId} = cust.id`
    )
    .innerJoin(
      sql`${userTable} creator`,
      sql`${transactionsTable.dibuatOleh} = creator.id`
    )
    .where(whereClause)
    .orderBy(desc(transactionsTable.id))
    .limit(limit + 1);

  const hasNext = rows.length > limit;
  const pageRows = hasNext ? rows.slice(0, limit) : rows;
  const nextCursor = hasNext
    ? String(pageRows[pageRows.length - 1].tx.id)
    : null;

  const pageTxIds = pageRows.map((r) => r.tx.id);

  const itemsMap = new Map<number, ItemTransaksi[]>();
  if (pageTxIds.length > 0) {
    const itemRows = await db
      .select({
        item: transactionItemsTable,
        wasteNama: wasteTypesTable.nama,
      })
      .from(transactionItemsTable)
      .innerJoin(
        wasteTypesTable,
        eq(transactionItemsTable.wasteTypeId, wasteTypesTable.id)
      )
      .where(inArray(transactionItemsTable.transactionId, pageTxIds));

    for (const { item, wasteNama } of itemRows) {
      const list = itemsMap.get(item.transactionId) ?? [];
      list.push({
        wasteTypeId: String(item.wasteTypeId),
        namaSampah: wasteNama,
        berat: normalisasiBerat(item.berat),
        hargaSnapshot: item.hargaSnapshot,
        subtotal: item.subtotal,
      });
      itemsMap.set(item.transactionId, list);
    }
  }

  const koreksiMap = new Map<number, string>();
  if (pageTxIds.length > 0) {
    const reversed = await db
      .select({ id: transactionsTable.id, reversesId: transactionsTable.reversesId })
      .from(transactionsTable)
      .where(inArray(transactionsTable.reversesId, pageTxIds));
    for (const r of reversed) {
      if (r.reversesId !== null) koreksiMap.set(r.reversesId, String(r.id));
    }
  }

  const items: TransaksiDetail[] = pageRows.map(({ tx, customerNama, customerUsername, dibuatOlehNama }) => {
    const dibalikOlehId = koreksiMap.get(tx.id) ?? null;
    return {
      id: String(tx.id),
      tipe: tx.tipe as TipeTransaksi,
      jumlah: tx.jumlah,
      waktu: tx.waktu.toISOString(),
      catatan: tx.catatan,
      dibuatOlehNama,
      sudahDibalik: dibalikOlehId !== null,
      membalikId: tx.reversesId ? String(tx.reversesId) : null,
      customerId: tx.customerId as UserId,
      customerNama,
      customerUsername,
      dibuatOlehId: tx.dibuatOleh as UserId,
      items: itemsMap.get(tx.id) ?? [],
      dibalikOlehId,
      fotoUrl: tx.tipe === "setor" ? tx.pathFoto : null,
      fotoUrlBerlakuHingga: null,
    };
  });

  return ok({ items, nextCursor });
}
