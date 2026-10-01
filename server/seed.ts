import { eq, or } from "drizzle-orm";
import { BuatPenggunaInputSchema } from "@/contract";
import { db } from "./db";
import { user } from "./db/auth-schema";
import { buatPasswordSementara, buatPenggunaDenganPassword } from "./pengguna";

/**
 * Satu-satunya jalur membuat pengguna tanpa sesi: bootstrap super_admin pertama.
 * Gagal bila sudah ada super_admin atau username sudah dipakai.
 */
export async function seedSuperAdmin(input: {
  username: unknown;
  nama: unknown;
}) {
  const username = BuatPenggunaInputSchema.shape.username.parse(input.username);
  const nama = BuatPenggunaInputSchema.shape.nama.parse(input.nama);

  const ada = await db
    .select({ role: user.role, username: user.username })
    .from(user)
    .where(or(eq(user.role, "super_admin"), eq(user.username, username)))
    .limit(1);
  if (ada.length > 0) {
    throw new Error(
      ada[0].username === username
        ? `Username "${username}" sudah dipakai. Seed dibatalkan.`
        : "Sudah ada super_admin. Seed hanya untuk bootstrap pertama; dibatalkan.",
    );
  }

  const passwordSementara = buatPasswordSementara(10);
  const userId = await buatPenggunaDenganPassword({
    username,
    nama,
    role: "super_admin",
    password: passwordSementara,
    mustChangePassword: true,
  });
  return { userId, username, passwordSementara };
}
