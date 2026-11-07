// Diperiksa tsc saja (`npm run typecheck`), tidak pernah dijalankan: implementasi asli harus
// memenuhi antarmuka Queries & Actions dari kontrak, baik sebagai namespace modul maupun
// sebagai objek yang dipakai saklar frontend (realQueries / realActions).
import "server-only";
import type { Actions, Queries } from "@/contract";
import * as realA from "./actions";
import * as realQ from "./queries";
import { realQueries } from "./queries";
import { realActions } from "./real-actions";

export const _q: Queries = realQ;
export const _a: Actions = realA;
export const _qObj: Queries = realQueries;
export const _aObj: Actions = realActions;
