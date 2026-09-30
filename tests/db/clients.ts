import postgres from "postgres";
import { afterAll } from "vitest";
import { urlTesDb } from "./env";

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;
/** Sql biasa atau transaksi: fungsi ledger bisa dipanggil dari keduanya. */
export type Db = Sql | Tx;

const { ownerUrl, appUrl } = urlTesDb();

const umum = { onnotice: () => {}, idle_timeout: 10 } as const;

/**
 * Koneksi per peran:
 * - owner        : login postgres (owner tabel). Hanya untuk setup data & tes trigger.
 * - app          : login app_server, seperti runtime server (prepare: false seperti pooler).
 * - anon / authenticated : role NOLOGIN di Supabase. Login dengan kredensial owner lalu
 *   startup option `-c role=<peran>`, sehingga SETIAP koneksi di pool sudah berjalan
 *   sebagai peran itu sejak awal (current_user = anon/authenticated). Tidak butuh
 *   kredensial tambahan di luar dua URL tes.
 */
export function bukaKoneksi() {
  const owner = postgres(ownerUrl, { ...umum, max: 4 });
  const app = postgres(appUrl, { ...umum, max: 4, prepare: false });
  const anon = postgres(ownerUrl, { ...umum, max: 1, connection: { options: "-c role=anon" } });
  const authenticated = postgres(ownerUrl, {
    ...umum,
    max: 1,
    connection: { options: "-c role=authenticated" },
  });

  // Tes paralel: tiap pemanggil punya client & koneksi fisik sendiri (max: 1).
  const paralel: Sql[] = Array.from({ length: 10 }, () =>
    postgres(appUrl, { ...umum, max: 1, prepare: false }),
  );

  afterAll(async () => {
    await Promise.all([owner, app, anon, authenticated, ...paralel].map((c) => c.end({ timeout: 5 })));
  });

  return { owner, app, anon, authenticated, paralel };
}
