import { isIP } from "node:net";

/**
 * IP klien untuk pembatas login.
 *
 * Hanya `x-vercel-forwarded-for`: Vercel mengisinya dengan IP publik klien, dan (berbeda dengan
 * x-forwarded-for) nilainya tidak ditimpa proxy yang mungkin dipasang di depan Vercel. Header
 * harus berisi TEPAT satu IP valid; daftar berkoma atau nilai aneh ditolak (null) supaya tidak
 * ada rantai yang bisa disisipi klien.
 *
 * null = IP tidak diketahui (dev lokal / bukan Vercel). Pemanggil melewati limiter per-IP,
 * BUKAN memasukkan semua orang ke satu ember bersama.
 */
export const HEADER_IP = "x-vercel-forwarded-for";

export function ipKlien(headers: Headers): string | null {
  const raw = headers.get(HEADER_IP)?.trim();
  if (!raw || raw.includes(",")) return null;
  const versi = isIP(raw);
  if (versi === 4) return raw;
  if (versi === 6) return normalisasiIPv6(raw);
  return null;
}

/** IPv4-mapped -> IPv4; selain itu dipangkas ke prefix /64 (satu pelanggan biasanya punya satu /64). */
function normalisasiIPv6(ip: string): string {
  const lower = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped && isIP(mapped[1]) === 4) return mapped[1];
  const [kiri, kanan = ""] = lower.split("::");
  const a = kiri ? kiri.split(":") : [];
  const b = lower.includes("::") && kanan ? kanan.split(":") : [];
  const grup = lower.includes("::")
    ? [...a, ...Array(8 - a.length - b.length).fill("0"), ...b]
    : a;
  return [
    ...grup.slice(0, 4).map((g) => g.padStart(4, "0")),
    "0000",
    "0000",
    "0000",
    "0000",
  ].join(":");
}
