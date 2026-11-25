// Presence & streak admin. GET = data dashboard (dipolling tiap 10 detik), POST = heartbeat tiap
// 30 detik saat tab terlihat, atau {status:"offline"} lewat sendBeacon saat tab ditutup.
// Modul server dimuat dinamis supaya build tidak mengevaluasi env server.

export async function GET() {
  const { getPresence } = await import("@/server/aktivitas-admin-route");
  return getPresence();
}

export async function POST(req: Request) {
  const { postPresence } = await import("@/server/aktivitas-admin-route");
  return postPresence(req);
}
