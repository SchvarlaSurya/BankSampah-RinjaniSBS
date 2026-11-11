// Foto profil (bucket privat). Mewajibkan sesi: pemilik foto, atau admin/super_admin.
// Nasabah tidak bisa melihat foto orang lain. Modul server dimuat dinamis (env tidak dievaluasi saat build).

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { sajikanFotoProfil } = await import("@/server/foto/profil-route");
  return sajikanFotoProfil(userId);
}
