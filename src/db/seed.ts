import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const { buatPenggunaDenganPassword } = await import("../../server/pengguna");
  const { auth } = await import("../../server/auth");
  const ctx = await auth.$context;
  
  console.log("Memulai seeding akun resmi dan dummy...");

  const accountsToSeed = [
    {
      username: "superadmin_rinjani",
      nama: "Super Admin Resmi",
      role: "super_admin",
      password: "SuperAdmin123!",
      mustChangePassword: false,
    },
    {
      username: "admin_rinjani",
      nama: "Admin Basic Resmi",
      role: "admin",
      password: "Admin123!",
      mustChangePassword: false,
    },
    {
      username: "nasabah_dummy1",
      nama: "Nasabah Dummy 1",
      role: "nasabah",
      password: "Nasabah123!",
      mustChangePassword: false,
    },
    {
      username: "nasabah_dummy2",
      nama: "Nasabah Dummy 2",
      role: "nasabah",
      password: "Nasabah123!",
      mustChangePassword: false,
    }
  ];

  for (const acc of accountsToSeed) {
    const email = `${acc.username}@bank-sampah.invalid`;
    const existing = await ctx.internalAdapter.findUserByEmail(email);
    
    if (existing) {
      console.log(`Akun dengan username '${acc.username}' sudah ada! Lewati...`);
      continue;
    }

    try {
      await buatPenggunaDenganPassword({
        username: acc.username,
        nama: acc.nama,
        role: acc.role as "super_admin" | "admin" | "nasabah",
        password: acc.password,
        mustChangePassword: acc.mustChangePassword,
      });
      console.log(`Berhasil membuat akun: ${acc.username} (Role: ${acc.role})`);
    } catch (e: any) {
      console.error(`Gagal membuat akun ${acc.username}: ${e.message}`);
    }
  }

  console.log("Seeding selesai!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Terjadi kesalahan saat seeding:", err);
  process.exit(1);
});
