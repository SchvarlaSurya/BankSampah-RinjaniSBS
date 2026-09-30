import { expect } from "vitest";
import { DB_ERROR_CODES, kodeDariPesanDb } from "@/contract";

export type DbErrorCode = (typeof DB_ERROR_CODES)[number];

export interface PgError {
  message: string;
  code?: string;
  detail?: string;
}

/** Error Postgres dari postgres.js langsung, atau dari `cause` bila dibungkus (mis. Drizzle). */
export function pgErrorDari(e: unknown): PgError {
  let cur: unknown = e;
  for (let i = 0; i < 3 && cur; i++) {
    const c = cur as { name?: string; severity?: unknown; cause?: unknown };
    if (c.name === "PostgresError" || typeof c.severity === "string") return c as PgError;
    cur = c.cause;
  }
  throw new Error(`Bukan error Postgres: ${String(e)}`);
}

export async function tangkap(p: Promise<unknown>): Promise<unknown> {
  let hasil: unknown;
  try {
    hasil = await p;
  } catch (e) {
    return e;
  }
  return expect.fail(`Diharapkan gagal, ternyata sukses: ${JSON.stringify(hasil)}`);
}

/** Kegagalan yang diharapkan dari fungsi SQL: MESSAGE persis sama dengan kode kontrak. */
export async function expectDbError(p: Promise<unknown>, kode: DbErrorCode): Promise<PgError> {
  const e = pgErrorDari(await tangkap(p));
  expect((DB_ERROR_CODES as readonly string[]).includes(kode)).toBe(true);
  expect(e.message).toBe(kode);
  expect(kodeDariPesanDb(e.message)).toBe(kode);
  return e;
}

/** Kegagalan non-kontrak (permission, trigger, constraint): cek SQLSTATE dan/atau pesan. */
export async function expectPgError(
  p: Promise<unknown>,
  harap: { sqlstate?: string; message?: RegExp | string },
): Promise<PgError> {
  const e = pgErrorDari(await tangkap(p));
  if (harap.sqlstate) expect(e.code).toBe(harap.sqlstate);
  if (typeof harap.message === "string") expect(e.message).toBe(harap.message);
  else if (harap.message) expect(e.message).toMatch(harap.message);
  // Bukan kode kontrak: lapisan TS akan memetakannya ke SERVER_ERROR.
  expect(kodeDariPesanDb(e.message)).toBe("SERVER_ERROR");
  return e;
}

export const PERMISSION_DENIED = "42501";
export const CHECK_VIOLATION = "23514";
