/**
 * src/lib/api/queries.ts
 *
 * SAKLAR RE-EXPORT — QUERIES
 * ===========================
 * Untuk beralih dari mock ke implementasi asli:
 * Ganti baris import di bawah dari mock ke real.
 *
 * MOCK  → import { mockQueries as q } from "./mock/queries";
 * REAL  → import { realQueries as q } from "@/src/server/api/queries";
 *
 * Kemudian ekspor ulang sebagai default.
 * JANGAN mengubah file halaman UI — cukup balik baris ini.
 */

import { mockQueries as q } from "./mock/queries";

// ── Saklar: uncomment salah satu ──────────────────────────────────────────────
// import { mockQueries as q } from "./mock/queries";   // ← MOCK (aktif sekarang)
// import { realQueries as q } from "@/src/server/api/queries"; // ← REAL

export const queries = q;
