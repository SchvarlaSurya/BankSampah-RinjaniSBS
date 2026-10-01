/**
 * bigint dari Postgres (postgres.js mengembalikan int8 sebagai string) -> number untuk kontrak.
 * Hanya bila aman (Number.isSafeInteger); selain itu melempar, dan pemanggil memetakannya ke
 * SERVER_ERROR + log. Jangan pernah Number() langsung tanpa cek.
 */
export function keNumberAman(nilai: string | number | bigint, label: string): number {
  const s = typeof nilai === "string" ? nilai.trim() : String(nilai);
  if (!/^-?\d+$/.test(s)) throw new Error(`${label} bukan bilangan bulat: ${s}`);
  const n = Number(s);
  if (!Number.isSafeInteger(n) || String(n) !== s.replace(/^(-?)0+(?=\d)/, "$1")) {
    throw new Error(`${label} di luar batas aman number: ${s}`);
  }
  return n;
}

/** idStr kontrak ("123") -> number untuk kolom bigint mode number; null bila tidak aman. */
export function idKeNumber(id: string): number | null {
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
