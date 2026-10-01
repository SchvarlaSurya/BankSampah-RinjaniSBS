import "server-only";
import { eq, or } from "drizzle-orm";
import { BuatPenggunaInputSchema } from "@/contract";
import { db } from "./db";
import { user } from "./db/auth-schema";
import { buatPasswordSementara, buatPenggunaDenganPassword, resetKePasswordSementara } from "./pengguna";

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

/**
 * Jalur darurat (bukan lewat UI): super_admin lupa password. Password sementara baru,
 * mustChangePassword=true, semua sesi dicabut, kunci login per-username dibuka.
 * Hanya untuk akun super_admin yang aktif.
 */
export async function resetPasswordSuperAdmin(input: { username: unknown }) {
  const username = BuatPenggunaInputSchema.shape.username.parse(input.username);
  const [u] = await db
    .select({ id: user.id, role: user.role, aktif: user.aktif })
    .from(user)
    .where(eq(user.username, username));
  if (!u) throw new Error(`Pengguna "${username}" tidak ditemukan.`);
  if (u.role !== "super_admin") throw new Error(`"${username}" bukan super_admin. Gunakan menu reset password di aplikasi.`);
  if (!u.aktif) throw new Error(`"${username}" nonaktif. Reset dibatalkan.`);
  const passwordSementara = await resetKePasswordSementara(u.id, username);
  return { username, passwordSementara };
}
