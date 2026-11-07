// node scripts/siapkan-db-dev.mjs
//   Menyiapkan Postgres dev lokal (docker-compose.dev.yml, localhost:54330):
//   1. migrate (drizzle-kit, sebagai owner)  2. set password role app_server
//   3. seed master jenis sampah (idempoten; yang sudah ada tidak diubah).
// Aman diulang. Hanya mau jalan ke localhost:54330, tidak pernah ke Supabase.
// Setelah ini, arahkan dev server lewat .env.development.local:
//   DATABASE_URL=postgres://app_server:app_server_dev@localhost:54330/postgres
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const OWNER_URL = "postgres://postgres:postgres@localhost:54330/postgres";
const APP_PASSWORD = "app_server_dev";
const APP_URL = `postgres://app_server:${APP_PASSWORD}@localhost:54330/postgres`;

const bin = (rel) => fileURLToPath(new URL(`../node_modules/${rel}`, import.meta.url));

function wajib(cmd, args, env) {
  console.log(`\n$ ${[cmd, ...args].join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

for (const u of [OWNER_URL, APP_URL]) {
  const url = new URL(u);
  if (url.hostname !== "localhost" || url.port !== "54330") throw new Error("hanya untuk DB dev lokal (localhost:54330)");
}

wajib(process.execPath, [bin("drizzle-kit/bin.cjs"), "migrate"], { DATABASE_URL_MIGRATE: OWNER_URL });

const owner = postgres(OWNER_URL, { max: 1, onnotice: () => {} });
try {
  const [q] = await owner`select format('alter role app_server password %L', ${APP_PASSWORD}::text) as q`;
  await owner.unsafe(q.q);
  console.log("\npassword role app_server di-set");
} finally {
  await owner.end({ timeout: 5 });
}

wajib(process.execPath, [bin("tsx/dist/cli.mjs"), "scripts/seed-jenis-sampah.ts", "--tulis"], { DATABASE_URL: APP_URL });
