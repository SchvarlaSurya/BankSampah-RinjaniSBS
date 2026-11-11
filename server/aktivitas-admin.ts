import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  type AktivitasAdmin,
  type AnggotaTimAdmin,
  PRESENCE,
  type Role,
  type TanggalWib,
  ZONA_WAKTU,
} from "@/contract";
import { computeStreak } from "@/lib/streak";
import { db } from "./db";
import { user } from "./db/auth-schema";
import { adminLoginDay, adminPresence, fotoProfil, systemKeepalive } from "./db/schema";
import { logServer } from "./errors";
import type { SesiServer } from "./guards";

const STAF: readonly Role[] = ["admin", "super_admin"];
export const termasukStaf = (role: Role) => STAF.includes(role);

/** Tanggal hari ini menurut jam DATABASE, zona Asia/Jakarta (bukan jam server aplikasi). */
const hariIniSql = sql`(now() at time zone ${ZONA_WAKTU})::date`;

/**
 * Catat hari ini untuk admin/super_admin (UPSERT, satu baris per hari WIB).
 * - "login": sign-in berhasil; count bertambah.
 * - "aktivitas": heartbeat dengan sesi lama (sesi bisa bertahan berhari-hari tanpa login ulang);
 *   baris hari ini dibuat bila belum ada, selain itu hanya last_at yang diperbarui.
 * Nasabah tidak pernah dicatat (pemanggil wajib memastikan role; dicek ulang di sini).
 */
export async function catatHariAdmin(userId: string, role: Role, sumber: "login" | "aktivitas"): Promise<void> {
  if (!termasukStaf(role)) return;
  await db
    .insert(adminLoginDay)
    .values({ userId, loginDate: sql`${hariIniSql}`, count: sumber === "login" ? 1 : 0 })
    .onConflictDoUpdate({
      target: [adminLoginDay.userId, adminLoginDay.loginDate],
      set: {
        lastAt: sql`now()`,
        count: sumber === "login" ? sql`${adminLoginDay.count} + 1` : sql`${adminLoginDay.count}`,
      },
    });
}

/** Dipanggil hook sesi Better Auth setelah login. Tidak pernah menggagalkan login. */
export async function catatLoginBerhasil(userId: string): Promise<void> {
  try {
    const [u] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId));
    if (u) await catatHariAdmin(userId, u.role, "login");
  } catch (e) {
    logServer("catatLoginBerhasil", e);
  }
}

/**
 * Heartbeat (tab admin terlihat). online_since dipertahankan selama heartbeat bersambung; bila
 * sebelumnya offline / terputus lebih dari ONLINE_DETIK, dimulai lagi dari sekarang.
 */
export async function catatHeartbeat(sesi: Pick<SesiServer, "userId" | "role">): Promise<void> {
  if (!termasukStaf(sesi.role)) return;
  const batas = sql`now() - make_interval(secs => ${PRESENCE.ONLINE_DETIK})`;
  await db
    .insert(adminPresence)
    .values({ userId: sesi.userId, lastSeenAt: sql`now()`, onlineSince: sql`now()` })
    .onConflictDoUpdate({
      target: adminPresence.userId,
      set: {
        onlineSince: sql`case
          when ${adminPresence.onlineSince} is null or ${adminPresence.lastSeenAt} < ${batas} then now()
          else ${adminPresence.onlineSince} end`,
        lastSeenAt: sql`now()`,
      },
    });
  await catatHariAdmin(sesi.userId, sesi.role, "aktivitas");
}

/** Logout / tab ditutup: tandai offline. last_seen_at tetap (untuk "Terakhir aktif"). */
export async function tandaiOffline(userId: string): Promise<void> {
  await db.update(adminPresence).set({ onlineSince: null }).where(eq(adminPresence.userId, userId));
}

/**
 * Data dashboard. Hak lihat ditegakkan DI SINI: admin biasa hanya menerima tanggal login
 * miliknya sendiri (streak anggota lain = null); super_admin menerima streak semua staf.
 * Status aktif semua staf boleh dilihat semua admin & super_admin.
 */
export async function muatAktivitasAdmin(sesi: Pick<SesiServer, "userId" | "role">): Promise<AktivitasAdmin> {
  const [jam] = await db.execute<{ server_now: string; hari_ini: string }>(
    sql`select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as server_now, (${hariIniSql})::text as hari_ini`,
  );
  const serverNow = jam.server_now;
  const hariIni = jam.hari_ini;

  const anggota = await db
    .select({
      id: user.id,
      nama: user.name,
      username: user.username,
      role: user.role,
      lastSeenAt: adminPresence.lastSeenAt,
      fotoDiperbarui: fotoProfil.diperbaruiAt,
      online: sql<boolean>`coalesce(${adminPresence.onlineSince} is not null
        and ${adminPresence.lastSeenAt} >= now() - make_interval(secs => ${PRESENCE.ONLINE_DETIK}), false)`,
    })
    .from(user)
    .leftJoin(adminPresence, eq(adminPresence.userId, user.id))
    .leftJoin(fotoProfil, eq(fotoProfil.userId, user.id))
    .where(and(inArray(user.role, ["admin", "super_admin"]), eq(user.aktif, true)))
    .orderBy(asc(user.role), asc(user.name));

  const bolehLihatSemua = sesi.role === "super_admin";
  const idDilihat = bolehLihatSemua ? anggota.map((a) => a.id) : [sesi.userId];
  const baris = idDilihat.length
    ? await db
        .select({ userId: adminLoginDay.userId, tanggal: sql<string>`${adminLoginDay.loginDate}::text` })
        .from(adminLoginDay)
        .where(inArray(adminLoginDay.userId, idDilihat))
    : [];
  const perUser = new Map<string, TanggalWib[]>();
  for (const b of baris) {
    const daftar = perUser.get(b.userId) ?? [];
    daftar.push(b.tanggal);
    perUser.set(b.userId, daftar);
  }
  const streakUntuk = (id: string) => computeStreak(perUser.get(id) ?? [], hariIni);

  const tim: AnggotaTimAdmin[] = anggota.map((a) => ({
    id: a.id,
    nama: a.nama,
    username: a.username ?? "",
    role: a.role === "super_admin" ? "super_admin" : "admin",
    online: a.online,
    lastSeenAt: a.lastSeenAt ? a.lastSeenAt.toISOString() : null,
    fotoVersi: a.fotoDiperbarui ? a.fotoDiperbarui.toISOString() : null,
    streak: bolehLihatSemua || a.id === sesi.userId ? streakUntuk(a.id) : null,
  }));

  return { serverNow, hariIni, saya: streakUntuk(sesi.userId), tim };
}

/** Cron keepalive: UPSERT satu baris (id = 1). */
export async function pingKeepalive(): Promise<{ lastPingAt: string; jumlahPing: number }> {
  const [r] = await db
    .insert(systemKeepalive)
    .values({ id: 1 })
    .onConflictDoUpdate({
      target: systemKeepalive.id,
      set: { lastPingAt: sql`now()`, jumlahPing: sql`${systemKeepalive.jumlahPing} + 1` },
    })
    .returning();
  return { lastPingAt: r.lastPingAt.toISOString(), jumlahPing: r.jumlahPing };
}
