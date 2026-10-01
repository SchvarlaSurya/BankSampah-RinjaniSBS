// Darurat: super_admin lupa password.
//   RESET_SUPERADMIN_USERNAME=... npm run reset:superadmin
// Butuh env server (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL), dibaca dari
// .env.local / .env bila ada. Password sementara dicetak SEKALI ke stdout; semua sesi
// akun itu dicabut dan password wajib diganti saat login.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const { resetPasswordSuperAdmin } = await import("../server/seed");
  const { username, passwordSementara } = await resetPasswordSuperAdmin({
    username: process.env.RESET_SUPERADMIN_USERNAME,
  });
  process.stdout.write(
    `Password super_admin "${username}" direset. Semua sesinya dicabut.\nPassword sementara (tampil sekali, wajib diganti saat login): ${passwordSementara}\n`,
  );
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(`Reset gagal: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
