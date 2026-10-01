// Fungsi baca untuk Server Component. Objek `realQueries` di akhir file dipakai saklar frontend.
import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  type ActionResult,
  type AuditInput,
  AuditInputSchema,
  type CariNasabahInput,
  CariNasabahInputSchema,
  fail,
  failDariZod,
  type GetNasabahInput,
  GetNasabahInputSchema,
  type GetTransaksiInput,
  GetTransaksiInputSchema,
  type Halaman,
  type HistoriInput,
  HistoriInputSchema,
  type JenisSampah,
  type NasabahRingkas,
  ok,
  type PenggunaRingkas,
  type Queries,
  type SesiInfo,
  type TransaksiDetail,
  type TransaksiRingkas,
} from "@/contract";
import { idKeNumber, keNumberAman } from "../angka";
import { db } from "../db";
import { user } from "../db/auth-schema";
import { transactions, wasteTypes } from "../db/schema";
import { logServer } from "../errors";
import { requireAkses } from "../guards";
import { muatTransaksiDetail, namaPembuatSql, sudahDibalikSql } from "../transaksi";
import { jalankan } from "./_jalankan";

/** Saldo dari view saldo_nasabah (bigint -> string dari driver). */
const saldoSql = sql<string>`coalesce((select s.saldo from public.saldo_nasabah s where s.customer_id = ${user.id}), 0)::text`;

const kolomNasabah = {
  id: user.id,
  username: user.username,
  nama: user.name,
  aktif: user.aktif,
  saldo: saldoSql,
};

function keNasabahRingkas(r: { id: string; username: string | null; nama: string; aktif: boolean; saldo: string }): NasabahRingkas {
  return {
    id: r.id,
    username: r.username ?? "",
    nama: r.nama,
    aktif: r.aktif,
    saldo: keNumberAman(r.saldo, `saldo ${r.id}`),
  };
}

/** Bukan ActionResult (kontrak): null bila tidak login atau akun nonaktif. */
export async function getSesi(): Promise<SesiInfo | null> {
  try {
    const g = await requireAkses("getSesi");
    if (!g.ok) return null;
    const { userId, username, nama, role, mustChangePassword } = g.sesi;
    return { userId, username, nama, role, mustChangePassword };
  } catch (e) {
    logServer("getSesi", e);
    return null;
  }
}

export async function getProfilSaya(): Promise<ActionResult<NasabahRingkas>> {
  return jalankan("getProfilSaya", async (sesi) => {
    const [r] = await db.select(kolomNasabah).from(user).where(eq(user.id, sesi.userId));
    if (!r) return fail("NASABAH_TIDAK_DITEMUKAN");
    return ok(keNasabahRingkas(r));
  });
}

/** Escape karakter khusus LIKE (\ % _) dari input pengguna; escape default Postgres = backslash. */
function polaPrefix(q: string): string {
  return `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function cariNasabah(input: CariNasabahInput): Promise<ActionResult<NasabahRingkas[]>> {
  return jalankan("cariNasabah", async () => {
    const parsed = CariNasabahInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const pola = polaPrefix(parsed.data.query);
    const rows = await db
      .select(kolomNasabah)
      .from(user)
      .where(and(eq(user.role, "nasabah"), or(ilike(user.username, pola), ilike(user.name, pola))))
      .orderBy(asc(user.username))
      .limit(20);
    return ok(rows.map(keNasabahRingkas));
  });
}

export async function getNasabah(input: GetNasabahInput): Promise<ActionResult<NasabahRingkas>> {
  return jalankan("getNasabah", async () => {
    const parsed = GetNasabahInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const [r] = await db
      .select(kolomNasabah)
      .from(user)
      .where(and(eq(user.id, parsed.data.customerId), eq(user.role, "nasabah")));
    if (!r) return fail("NASABAH_TIDAK_DITEMUKAN");
    return ok(keNasabahRingkas(r));
  });
}

// Kontrak tidak punya skema untuk input ini; divalidasi di sini dengan bentuk yang sama.
const ListJenisSampahInputSchema = z.object({ termasukNonaktif: z.boolean().optional() }).optional();

export async function listJenisSampah(input?: { termasukNonaktif?: boolean }): Promise<ActionResult<JenisSampah[]>> {
  return jalankan("listJenisSampah", async (sesi) => {
    const parsed = ListJenisSampahInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    // Admin hanya melihat yang aktif (form setor); hanya super_admin boleh termasukNonaktif.
    const semua = sesi.role === "super_admin" && parsed.data?.termasukNonaktif === true;
    const rows = await db
      .select()
      .from(wasteTypes)
      .where(semua ? undefined : eq(wasteTypes.aktif, true))
      .orderBy(asc(wasteTypes.nama));
    return ok(rows.map((r) => ({ id: String(r.id), nama: r.nama, hargaBeli: r.hargaBeli, aktif: r.aktif })));
  });
}

export async function listStaf(): Promise<ActionResult<PenggunaRingkas[]>> {
  return jalankan("listStaf", async () => {
    const rows = await db
      .select({ id: user.id, username: user.username, nama: user.name, role: user.role, aktif: user.aktif })
      .from(user)
      .where(inArray(user.role, ["admin", "super_admin"]))
      .orderBy(asc(user.role), asc(user.username));
    return ok(rows.map((r) => ({ ...r, username: r.username ?? "" })));
  });
}

// ─── Transaksi ───────────────────────────────────────────────────────────────

/** Halaman berbasis cursor id (urut id DESC): ambil limit+1 untuk tahu ada halaman berikutnya. */
function potongHalaman<T extends { id: string }>(baris: T[], limit: number): Halaman<T> {
  const ada = baris.length > limit;
  const items = ada ? baris.slice(0, limit) : baris;
  return { items, nextCursor: ada ? items[items.length - 1].id : null };
}

function filterCursor(cursor: string | undefined): SQL | undefined {
  if (cursor === undefined) return undefined;
  return lt(transactions.id, idKeNumber(cursor) ?? Number.MAX_SAFE_INTEGER);
}

export async function getHistori(input: HistoriInput): Promise<ActionResult<Halaman<TransaksiRingkas>>> {
  return jalankan("getHistori", async (sesi) => {
    const parsed = HistoriInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const { cursor, limit } = parsed.data;

    // Nasabah selalu dipaksa ke dirinya sendiri; customerId kiriman klien diabaikan.
    const customerId = sesi.role === "nasabah" ? sesi.userId : parsed.data.customerId;
    if (sesi.role !== "nasabah") {
      const [n] = await db.select({ id: user.id }).from(user).where(and(eq(user.id, customerId), eq(user.role, "nasabah")));
      if (!n) return fail("NASABAH_TIDAK_DITEMUKAN");
    }

    const baris = await db
      .select({
        id: sql<string>`${transactions.id}::text`,
        tipe: transactions.tipe,
        jumlah: transactions.jumlah,
        waktu: transactions.waktu,
        catatan: transactions.catatan,
        dibuatOlehNama: namaPembuatSql,
        sudahDibalik: sudahDibalikSql,
        membalikId: sql<string | null>`${transactions.reversesId}::text`,
      })
      .from(transactions)
      .where(and(eq(transactions.customerId, customerId), filterCursor(cursor)))
      .orderBy(desc(transactions.id))
      .limit(limit + 1);

    return ok(potongHalaman(baris.map((b) => ({ ...b, waktu: b.waktu.toISOString() })), limit));
  });
}

export async function getTransaksi(input: GetTransaksiInput): Promise<ActionResult<TransaksiDetail>> {
  return jalankan("getTransaksi", async (sesi) => {
    const parsed = GetTransaksiInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const [detail] = await muatTransaksiDetail([parsed.data.id], sesi);
    // Transaksi nasabah lain sengaja tidak dibedakan dari "tidak ada".
    if (!detail || (sesi.role === "nasabah" && detail.customerId !== sesi.userId)) {
      return fail("TRANSAKSI_TIDAK_DITEMUKAN");
    }
    return ok(detail);
  });
}

/** "YYYY-MM-DD" yang benar-benar ada di kalender (regex kontrak saja menerima 2026-02-30). */
function tanggalSah(t: string): boolean {
  const [y, m, d] = t.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export async function auditTransaksi(input: AuditInput): Promise<ActionResult<Halaman<TransaksiDetail>>> {
  return jalankan("auditTransaksi", async (sesi) => {
    const parsed = AuditInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const { adminId, tipe, dari, sampai, cursor, limit } = parsed.data;

    const fieldErrors: Record<string, string[]> = {};
    if (dari !== undefined && !tanggalSah(dari)) fieldErrors.dari = ["Tanggal tidak valid"];
    if (sampai !== undefined && !tanggalSah(sampai)) fieldErrors.sampai = ["Tanggal tidak valid"];
    if (Object.keys(fieldErrors).length) return fail("VALIDASI_GAGAL", { fieldErrors });

    // Batas tanggal = kalender Asia/Jakarta, inklusif, dihitung di SQL:
    // [dari 00:00 WIB, (sampai + 1 hari) 00:00 WIB).
    const ids = await db
      .select({ id: sql<string>`${transactions.id}::text` })
      .from(transactions)
      .where(
        and(
          adminId !== undefined ? eq(transactions.dibuatOleh, adminId) : undefined,
          tipe !== undefined ? eq(transactions.tipe, tipe) : undefined,
          dari !== undefined
            ? gte(transactions.waktu, sql`(${dari}::date::timestamp at time zone 'Asia/Jakarta')`)
            : undefined,
          sampai !== undefined
            ? lt(transactions.waktu, sql`((${sampai}::date + 1)::timestamp at time zone 'Asia/Jakarta')`)
            : undefined,
          filterCursor(cursor),
        ),
      )
      .orderBy(desc(transactions.id))
      .limit(limit + 1);

    const halaman = potongHalaman(ids, limit);
    const detail = await muatTransaksiDetail(halaman.items.map((r) => r.id), sesi);
    return ok({ items: detail, nextCursor: halaman.nextCursor });
  });
}

/** Objek untuk saklar frontend (src/lib/api/queries.ts). Dicek `Queries` oleh tsc. */
export const realQueries: Queries = {
  getSesi,
  getProfilSaya,
  cariNasabah,
  getNasabah,
  listJenisSampah,
  listStaf,
  getHistori,
  getTransaksi,
  auditTransaksi,
};
