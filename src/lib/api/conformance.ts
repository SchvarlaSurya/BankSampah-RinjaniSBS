/**
 * src/lib/api/conformance.ts
 *
 * PENGECEKAN TIPE OTOMATIS (Conformance Check)
 * =============================================
 * File ini TIDAK dijalankan saat runtime — hanya dipakai oleh tsc.
 * Tujuannya: memastikan mock DAN implementasi asli (jika ada) sama-sama
 * memenuhi interface Queries & Actions dari kontrak.
 *
 * Cara pakai:
 *   npx tsc --noEmit
 *
 * Jika ada ketidakcocokan antara mock/implementasi dengan kontrak,
 * tsc akan langsung error dan build gagal.
 *
 * Tambahkan script ke package.json:
 *   "typecheck": "tsc --noEmit"
 */

import type { Queries, Actions } from "@/src/contract";

// ── Mock — selalu dicek ───────────────────────────────────────────────────────

import { mockQueries } from "./mock/queries";
import { mockActions } from "./mock/actions";

// Pengecekan tipe: mockQueries harus mengimplementasikan Queries sepenuhnya.
const _checkMockQueries: Queries = mockQueries;
void _checkMockQueries;

// Pengecekan tipe: mockActions harus mengimplementasikan Actions sepenuhnya.
const _checkMockActions: Actions = mockActions;
void _checkMockActions;

// ── Real (Backend) — uncomment saat implementasi asli sudah ada ───────────────
//
// import { realQueries } from "@/src/server/api/queries";
// import { realActions } from "@/src/server/api/actions";
//
// const _checkRealQueries: Queries = realQueries;
// void _checkRealQueries;
//
// const _checkRealActions: Actions = realActions;
// void _checkRealActions;

export {};
