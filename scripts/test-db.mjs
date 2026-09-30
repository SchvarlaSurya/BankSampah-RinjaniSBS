// npm run test:db [-- <argumen vitest>]
//   Reset Postgres lokal (docker compose down/up), migrate dari nol, lalu jalankan vitest.
// node scripts/test-db.mjs --reset-only
//   Hanya reset + migrate (untuk pengecekan manual).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { urlTesDb } from "../tests/db/env.ts";

// Entry CLI tidak diekspor lewat "exports" paket, jadi pakai path langsung.
const bin = (rel) => fileURLToPath(new URL(`../node_modules/${rel}`, import.meta.url));
const args = process.argv.slice(2);
const resetOnly = args[0] === "--reset-only";

// Guard host/port sebelum menyentuh apa pun.
let ownerUrl;
try {
  ({ ownerUrl } = urlTesDb());
} catch (e) {
  console.error(`
[test:db] ${e.message}
`);
  process.exit(1);
}

function jalankan(cmd, cmdArgs, env = process.env) {
  console.log(`\n$ ${[cmd, ...cmdArgs].join(" ")}`);
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", env });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

function wajib(cmd, cmdArgs, env) {
  const status = jalankan(cmd, cmdArgs, env);
  if (status !== 0) process.exit(status);
}

wajib("docker", ["compose", "down"]);
wajib("docker", ["compose", "up", "-d", "--wait", "db"]);
// DATABASE_URL_MIGRATE di-set eksplisit ke DB tes lokal (menimpa nilai apa pun dari shell/.env).
wajib(process.execPath, [bin("drizzle-kit/bin.cjs"), "migrate"], {
  ...process.env,
  DATABASE_URL_MIGRATE: ownerUrl,
});

if (!resetOnly) {
  process.exit(jalankan(process.execPath, [bin("vitest/vitest.mjs"), "run", ...args]));
}
