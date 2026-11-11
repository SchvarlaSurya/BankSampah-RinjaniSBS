import "server-only";
import { and, eq, ne, sql, type SQL } from "drizzle-orm";
import { type ActionResult, type ErrorCode, fail, type HapusPenggunaResult, ok } from "@/contract";
import { db } from "./db";
import { account, session, user } from "./db/auth-schema";
import { adminLoginDay, adminPresence, auditAkun, loginGagalUsername } from "./db/schema";
import { pgErrorDari } from "./errors";

/**
 * true bila akun sudah punya riwayat yang harus tetap utuh:
 * - transaksi apa pun sebagai nasabah (setor/tarik/koreksi/penyesuaian; saldo != 0 tercakup di sini)
 * - transaksi yang dicatatnya sebagai petugas
 * - riwayat harga yang diubahnya
 * - log audit akun yang dilakukannya
 */
/**
 * Kolom id user query luar, selalu berkualifikasi tabel. Kolom Drizzle di dalam sql`` pada select
 * satu tabel dirender tanpa nama tabel ("id"), yang di dalam subquery akan menunjuk ke tabel
 * subquery itu sendiri (transactions.id).
 */
export const idUserLuar = sql.raw(`"user"."id"`);

export function punyaRiwayatSql(userId: SQL | string): SQL<boolean> {
  return sql<boolean>`(
    exists (select 1 from public.transactions t where t.customer_id = ${userId})
    or exists (select 1 from public.transactions t where t.dibuat_oleh = ${userId})
    or exists (select 1 from public.price_history p where p.diubah_oleh = ${userId})
    or exists (select 1 from public.audit_akun a where a.pelaku_id = ${userId})
  )`;
}

/** Super_admin aktif selain akun ini (untuk aturan "bukan super_admin terakhir"). */
export function superAdminLainSql(userId: SQL | string): SQL<number> {
  return sql<number>`(select count(*)::int from public."user" s
    where s.role = 'super_admin' and s.aktif and s.id <> ${userId})`;
}

/** Alasan akun tidak boleh dihapus, dilihat dari sudut pandang `pelakuId`; null = boleh. */
export function alasanTidakBisaDihapus(r: {
  id: string;
  role: string;
  punyaRiwayat: boolean;
  superAdminLain: number;
  pelakuId: string;
}): ErrorCode | null {
  if (r.id === r.pelakuId) return "TIDAK_BISA_HAPUS_DIRI";
  if (r.role === "super_admin" && r.superAdminLain < 1) return "SUPER_ADMIN_TERAKHIR";
  if (r.punyaRiwayat) return "AKUN_PUNYA_RIWAYAT";
  return null;
}

/** Konfirmasi harus sama persis (setelah trim) dengan ID atau nama akun di DB. */
export function konfirmasiCocok(konfirmasi: string, target: { username: string; nama: string }): boolean {
  const k = konfirmasi.trim();
  return k.length > 0 && (k === target.username || k === target.nama.trim());
}

/**
 * Hapus akun dalam SATU transaksi DB. Baris target dikunci FOR UPDATE lalu semua syarat dicek
 * ULANG di dalam transaksi (mencegah balapan dengan setor/tarik/hapus lain). FK transactions /
 * price_history / audit_akun ke user tetap menjadi pengaman terakhir (23503 -> AKUN_PUNYA_RIWAYAT).
 *
 * Yang dihapus: baris user, account & session (auth), admin_login_day, admin_presence, kunci
 * login per-username. Log audit dicatat di transaksi yang sama. `sebelumCommit` dipakai pemanggil
 * untuk menghapus data milik akun yang ada di tabel lain (mis. foto profil) di transaksi yang sama.
 */
export async function hapusAkun(
  pelakuId: string,
  input: { userId: string; konfirmasi: string; alasan: string },
  opsi: { sebelumCommit?: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string) => Promise<void> } = {},
): Promise<ActionResult<HapusPenggunaResult>> {
  try {
    return await db.transaction(async (tx) => {
      const [t] = await tx
        .select({ id: user.id, username: user.username, nama: user.name, role: user.role })
        .from(user)
        .where(eq(user.id, input.userId))
        .for("update");
      if (!t) return fail("PENGGUNA_TIDAK_DITEMUKAN");
      const target = { ...t, username: t.username ?? "" };

      if (target.id === pelakuId) return fail("TIDAK_BISA_HAPUS_DIRI");
      if (!konfirmasiCocok(input.konfirmasi, target)) {
        return fail("VALIDASI_GAGAL", { fieldErrors: { konfirmasi: ["Ketik ID atau nama akun persis seperti yang tertulis"] } });
      }

      if (target.role === "super_admin") {
        // Kunci semua super_admin aktif lain: dua penghapusan bersamaan tidak bisa menghabiskannya.
        const lain = await tx
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.role, "super_admin"), eq(user.aktif, true), ne(user.id, target.id)))
          .for("update");
        if (lain.length < 1) return fail("SUPER_ADMIN_TERAKHIR");
      }

      const [cek] = await tx.execute<{ ada: boolean }>(sql`select ${punyaRiwayatSql(target.id)} as ada`);
      if (cek?.ada) return fail("AKUN_PUNYA_RIWAYAT");

      await opsi.sebelumCommit?.(tx, target.id);
      await tx.delete(adminLoginDay).where(eq(adminLoginDay.userId, target.id));
      await tx.delete(adminPresence).where(eq(adminPresence.userId, target.id));
      await tx.delete(session).where(eq(session.userId, target.id));
      await tx.delete(account).where(eq(account.userId, target.id));
      if (target.username) await tx.delete(loginGagalUsername).where(eq(loginGagalUsername.username, target.username));
      await tx.delete(user).where(eq(user.id, target.id));

      await tx.insert(auditAkun).values({
        aksi: "hapus_akun",
        pelakuId,
        targetUserId: target.id,
        targetUsername: target.username,
        targetNama: target.nama,
        targetRole: target.role,
        alasan: input.alasan.trim(),
      });

      return ok({ id: target.id, username: target.username });
    });
  } catch (e) {
    // Balapan: transaksi / riwayat baru masuk setelah pengecekan -> FK menolak DELETE user.
    if (pgErrorDari(e)?.code === "23503") return fail("AKUN_PUNYA_RIWAYAT");
    throw e;
  }
}
