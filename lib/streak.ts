/**
 * Perhitungan streak login harian admin. Fungsi murni (tanpa DB, tanpa jam sistem) supaya mudah
 * dites; dipakai server (getAktivitasAdmin) dan aman diimpor klien.
 *
 * Aturan:
 * - Beberapa login dalam satu hari = satu hari.
 * - Masuk hari ini setelah masuk kemarin: streak bertambah (1, 2, 3, ...).
 * - Ada satu hari terlewat: streak putus, login berikutnya mulai lagi dari 1.
 * - Hari ini belum masuk tetapi kemarin masuk: streak belum putus (current = streak s.d. kemarin).
 * - Batas hari = tengah malam Asia/Jakarta (tanggal sudah dalam WIB, lihat tanggalWib).
 */
import { type StreakInfo, type TanggalWib, ZONA_WAKTU } from "@/contract";

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const SEHARI_MS = 86_400_000;

function keHari(t: TanggalWib): number {
  if (!POLA_TANGGAL.test(t)) throw new Error(`tanggal tidak valid: ${t}`);
  const [y, m, d] = t.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / SEHARI_MS);
}

function dariHari(n: number): TanggalWib {
  return new Date(n * SEHARI_MS).toISOString().slice(0, 10);
}

/** Geser tanggal kalender sejumlah hari (bisa negatif). */
export function geserTanggal(t: TanggalWib, hari: number): TanggalWib {
  return dariHari(keHari(t) + hari);
}

/** Tanggal kalender Asia/Jakarta dari sebuah waktu. */
export function tanggalWib(waktu: Date): TanggalWib {
  // en-CA memformat sebagai YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_WAKTU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(waktu);
}

export function computeStreak(tanggal: readonly TanggalWib[], hariIni: TanggalWib): StreakInfo {
  const hariIniN = keHari(hariIni);
  // Unik, hanya s.d. hari ini (tanggal masa depan dari jam yang kacau diabaikan), urut naik.
  const hari = [...new Set(tanggal.map(keHari))].filter((n) => n <= hariIniN).sort((a, b) => a - b);
  const ada = new Set(hari);

  let longest = 0;
  let jalan = 0;
  for (let i = 0; i < hari.length; i++) {
    jalan = i > 0 && hari[i] === hari[i - 1] + 1 ? jalan + 1 : 1;
    if (jalan > longest) longest = jalan;
  }

  const sudahMasukHariIni = ada.has(hariIniN);
  let current = 0;
  let n = sudahMasukHariIni ? hariIniN : hariIniN - 1;
  while (ada.has(n)) {
    current++;
    n--;
  }

  const tujuhHari = Array.from({ length: 7 }, (_, i) => {
    const h = hariIniN - 6 + i;
    return { tanggal: dariHari(h), masuk: ada.has(h) };
  });

  return { current, longest, sudahMasukHariIni, tujuhHari };
}
