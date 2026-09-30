// Bootstrap super_admin pertama.
//   SEED_SUPERADMIN_USERNAME=... SEED_SUPERADMIN_NAMA="..." npm run seed:superadmin
// Butuh env server (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL), dibaca dari
// .env.local / .env bila ada. Password sementara dicetak SEKALI ke stdout.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const { seedSuperAdmin } = await import("../server/seed");
  const { username, passwordSementara } = await seedSuperAdmin({
    username: process.env.SEED_SUPERADMIN_USERNAME,
    nama: process.env.SEED_SUPERADMIN_NAMA,
  });
  process.stdout.write(
    `super_admin "${username}" dibuat.\nPassword sementara (tampil sekali, wajib diganti saat login pertama): ${passwordSementara}\n`,
  );
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(`Seed gagal: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
