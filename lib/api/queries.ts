/**
 * lib/api/queries.ts
 *
 * SAKLAR — QUERIES (server-only)
 * ==============================
 * Pilih SATU baris import di bawah. Halaman UI tidak berubah.
 *
 * MOCK → import { mockQueries as q } from "./mock/queries";
 * ASLI → import { realQueries as q } from "@/server/api/queries";
 *
 * Kedua implementasi mengimpor "server-only": query HANYA boleh dipanggil dari
 * Server Component (kontrak Bagian 9). Client Component menerima datanya lewat props.
 */

import { mockQueries as q } from "./mock/queries"; // ← MOCK (aktif)
// import { realQueries as q } from "@/server/api/queries"; // ← ASLI

export const queries = q;
