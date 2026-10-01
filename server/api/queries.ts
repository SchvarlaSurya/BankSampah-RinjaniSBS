// Fungsi baca untuk Server Component. Objek `realQueries` di akhir file dipakai saklar frontend.

import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  type ActionResult,
  type CariNasabahInput,
  CariNasabahInputSchema,
  fail,
  failDariZod,
  type GetNasabahInput,
  GetNasabahInputSchema,
  type JenisSampah,
  type NasabahRingkas,
  ok,
  type PenggunaRingkas,
  type SesiInfo,
} from "@/contract";
import { keNumberAman } from "../angka";
import { db } from "../db";
import { user } from "../db/auth-schema";
import { wasteTypes } from "../db/schema";
import { logServer } from "../errors";
import { requireAkses } from "../guards";
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
