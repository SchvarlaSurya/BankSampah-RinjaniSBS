import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { loginGagalIp, loginGagalUsername } from "./db/schema";

export const JENDELA_DETIK = 15 * 60;
export const MAKS_GAGAL_USERNAME = 5;
export const MAKS_GAGAL_IP = 30;

export type Percobaan =
  | { terkunci: true; retryAfterDetik: number }
  | { terkunci: false; idUsername: number; idIp: number | null };

const batasJendela = sql`now() - make_interval(secs => ${JENDELA_DETIK})`;

/**
 * Catat percobaan SEBELUM memeriksa password, lalu hitung. Karena baris sudah ada saat
 * dihitung, burst paralel tidak bisa lolos bersama-sama melewati batas: tiap request ikut
 * menghitung percobaan request lain yang sudah tercatat.
 * Kalau terkunci, baris percobaan ini dihapus lagi supaya mencoba saat terkunci tidak
 * memperpanjang waktu tunggu.
 */
export async function mulaiPercobaan(
  username: string,
  ip: string | null,
): Promise<Percobaan> {
  const [{ id: idUsername }] = await db
    .insert(loginGagalUsername)
    .values({ username })
    .returning({ id: loginGagalUsername.id });
  const idIp = ip
    ? (
        await db
          .insert(loginGagalIp)
          .values({ ip })
          .returning({ id: loginGagalIp.id })
      )[0].id
    : null;

  const tungguUsername = await sisaKunci(
    loginGagalUsername,
    loginGagalUsername.username,
    username,
    MAKS_GAGAL_USERNAME,
  );
  const tungguIp = ip
    ? await sisaKunci(loginGagalIp, loginGagalIp.ip, ip, MAKS_GAGAL_IP)
    : 0;

  if (tungguUsername > 0 || tungguIp > 0) {
    await hapus(idUsername, idIp);
    return {
      terkunci: true,
      retryAfterDetik: Math.max(tungguUsername, tungguIp),
    };
  }
  return { terkunci: false, idUsername, idIp };
}

/** Login sukses: hitungan per-username di-reset; percobaan IP ini tidak dihitung. */
export async function percobaanBerhasil(
  username: string,
  p: { idIp: number | null },
): Promise<void> {
  await db
    .delete(loginGagalUsername)
    .where(eq(loginGagalUsername.username, username));
  if (p.idIp !== null)
    await db.delete(loginGagalIp).where(eq(loginGagalIp.id, p.idIp));
}

/** Gagal: baris percobaan dibiarkan; baris kedaluwarsa untuk kunci yang sama dibersihkan. */
export async function percobaanGagal(
  username: string,
  ip: string | null,
): Promise<void> {
  await db
    .delete(loginGagalUsername)
    .where(
      and(
        eq(loginGagalUsername.username, username),
        lt(loginGagalUsername.waktu, batasJendela),
      ),
    );
  if (ip)
    await db
      .delete(loginGagalIp)
      .where(
        and(eq(loginGagalIp.ip, ip), lt(loginGagalIp.waktu, batasJendela)),
      );
}

async function hapus(idUsername: number, idIp: number | null) {
  await db
    .delete(loginGagalUsername)
    .where(eq(loginGagalUsername.id, idUsername));
  if (idIp !== null)
    await db.delete(loginGagalIp).where(eq(loginGagalIp.id, idIp));
}

/**
 * Detik sampai kunci terbuka; 0 = tidak terkunci. Terkunci bila percobaan dalam jendela
 * (termasuk yang sedang berjalan) > maks. Kunci terbuka saat percobaan ke-`maks` terbaru
 * (tanpa menghitung percobaan ini) keluar dari jendela.
 */
async function sisaKunci(
  tabel: typeof loginGagalUsername | typeof loginGagalIp,
  kolom: typeof loginGagalUsername.username | typeof loginGagalIp.ip,
  nilai: string,
  maks: number,
): Promise<number> {
  const baris = await db
    .select({
      tunggu: sql<number>`ceil(extract(epoch from (${tabel.waktu} + make_interval(secs => ${JENDELA_DETIK}) - now())))::int`,
    })
    .from(tabel)
    .where(and(eq(kolom, nilai), gt(tabel.waktu, batasJendela)))
    .orderBy(desc(tabel.waktu), desc(tabel.id))
    .limit(maks + 1);
  if (baris.length <= maks) return 0;
  // baris[0] = percobaan ini; baris[maks] = percobaan ke-maks sebelum ini.
  return Math.max(1, baris[maks].tunggu);
}
