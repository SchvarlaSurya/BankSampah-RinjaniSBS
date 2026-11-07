import { type ErrorCode, kodeDariPesanDb } from "@/contract";

interface PgErrorLike {
  message: string;
  code?: string;
  detail?: string;
  constraint_name?: string;
  routine?: string;
}

/** Error Postgres dari postgres.js langsung atau dari `cause` (Drizzle membungkusnya). */
function pgErrorDari(e: unknown): PgErrorLike | null {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) {
    const c = cur as { name?: string; severity?: unknown; cause?: unknown };
    if (c.name === "PostgresError" || typeof c.severity === "string")
      return c as PgErrorLike;
    cur = c.cause;
  }
  return null;
}

/**
 * Log sisi server. Sengaja hanya field terpilih: error postgres.js juga membawa `query` dan
 * `parameters` (bisa berisi password / path foto), jadi objek error TIDAK pernah di-log utuh.
 */
export function logServer(konteks: string, e: unknown): void {
  const pg = pgErrorDari(e);
  if (pg) {
    console.error(`[${konteks}] db error`, {
      sqlstate: pg.code,
      message: pg.message,
      detail: pg.detail,
      constraint: pg.constraint_name,
      routine: pg.routine,
    });
    return;
  }
  const err = e as
    { name?: string; message?: string; stack?: string } | undefined;
  console.error(`[${konteks}] error`, {
    name: err?.name,
    message: err?.message,
    stack: err?.stack,
  });
}

/**
 * Error dari fungsi SQL -> kode kontrak. MESSAGE di luar DB_ERROR_CODES menjadi SERVER_ERROR.
 * DETAIL Postgres hanya masuk log server; yang dikembalikan hanya kodenya.
 */
export function petaErrorDb(konteks: string, e: unknown): ErrorCode {
  const pg = pgErrorDari(e);
  const kode = kodeDariPesanDb(pg?.message);
  if (kode === "SERVER_ERROR") logServer(konteks, e);
  else if (pg?.detail)
    console.info(`[${konteks}] ${kode}`, { detail: pg.detail });
  return kode;
}
