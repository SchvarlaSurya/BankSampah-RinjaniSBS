// Keepalive harian (Vercel Cron, lihat vercel.json): menulis satu baris system_keepalive supaya
// database selalu punya perubahan walau tidak ada admin yang login. Wajib header
// Authorization: Bearer <CRON_SECRET>.

export async function GET(req: Request) {
  const { getKeepalive } = await import("@/server/aktivitas-admin-route");
  return getKeepalive(req);
}
