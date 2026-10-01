// Diperiksa tsc saja (`npm run typecheck`), tidak pernah dijalankan: implementasi asli harus
// memenuhi antarmuka Queries & Actions dari kontrak, termasuk lewat namespace modulnya.
import "server-only";
import type { Actions, Queries } from "@/contract";
import * as realA from "./actions";
import * as realQ from "./queries";
import { realActions } from "./real-actions";
import { realQueries } from "./queries";

const _q: Queries = realQ;
const _a: Actions = realA;
const _qObj: Queries = realQueries;
const _aObj: Actions = realActions;

export type _Conformance = [typeof _q, typeof _a, typeof _qObj, typeof _aObj];
