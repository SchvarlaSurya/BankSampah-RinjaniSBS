import postgres from "postgres";
import { urlTesDb } from "./env";

// Dijalankan sekali sebelum semua file tes. Migration dijalankan oleh `npm run test:db`
// (scripts/test-db.mjs); di sini hanya verifikasi & password app_server lokal.
export default async function setup() {
  const { ownerUrl, appPassword } = urlTesDb();
  const owner = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  try {
    const [f] = await owner`
      select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('setor', 'tarik', 'koreksi')`;
    if (f.n !== 3) {
      throw new Error("Fungsi setor/tarik/koreksi belum ada. Jalankan `npm run test:db` (reset + migrate).");
    }
    // app_server dibuat migration TANPA password; di DB lokal di-set dari TEST_DATABASE_URL_APP.
    const [q] = await owner`select format('alter role app_server password %L', ${appPassword}::text) as q`;
    await owner.unsafe(q.q);
  } finally {
    await owner.end({ timeout: 5 });
  }
}
