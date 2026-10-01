import type { Queries, Actions } from "@/src/contract";

import { mockQueries } from "./mock/queries";
import { mockActions } from "./mock/actions";
import * as realQueriesModule from "@/src/server/api/queries";
import * as realActionsModule from "@/src/server/api/actions";

const _checkMockQueries: Queries = mockQueries;
void _checkMockQueries;

const _checkMockActions: Actions = mockActions;
void _checkMockActions;

const _checkRealQueries: Queries = realQueriesModule;
void _checkRealQueries;

const _checkRealActions: Actions = realActionsModule;
void _checkRealActions;

export {};
