/**
 * lib/api/conformance.ts
 *
 * PENGECEKAN TIPE (dipakai tsc saja, tidak diimpor saat runtime).
 * Mock DAN implementasi asli wajib memenuhi Queries & Actions dari kontrak.
 * Kalau salah satu menyimpang, `npm run typecheck` gagal.
 */

import type { Queries, Actions } from "@/contract";

import { mockQueries } from "./mock/queries";
import { mockActions } from "./mock/actions";
import { realQueries } from "@/server/api/queries";
import { realActions } from "@/server/api/real-actions";

const _checkMockQueries: Queries = mockQueries;
const _checkMockActions: Actions = mockActions;
const _checkRealQueries: Queries = realQueries;
const _checkRealActions: Actions = realActions;
void _checkMockQueries;
void _checkMockActions;
void _checkRealQueries;
void _checkRealActions;

export {};
