/**
 * src/lib/api/actions.ts
 *
 * SAKLAR RE-EXPORT — ACTIONS
 * ===========================
 * Untuk beralih dari mock ke implementasi asli:
 * Ganti baris import di bawah dari mock ke real.
 *
 * MOCK  → import { mockActions as a } from "./mock/actions";
 * REAL  → import { realActions as a } from "@/src/server/api/actions";
 *
 * Kemudian ekspor ulang sebagai default.
 * JANGAN mengubah file halaman UI — cukup balik baris ini.
 *
 * CATATAN: Actions dipanggil dari Client Component via Server Actions.
 * Pastikan file Server Action yang membungkus actions ini menggunakan
 * directive "use server" dan diimpor dengan benar.
 */

import { mockActions as a } from "./mock/actions";

// ── Saklar: uncomment salah satu ──────────────────────────────────────────────
// import { mockActions as a } from "./mock/actions";       // ← MOCK (aktif sekarang)
// import { realActions as a } from "@/src/server/api/actions"; // ← REAL

export const actions = a;
