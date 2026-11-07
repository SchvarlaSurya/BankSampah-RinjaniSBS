// Route DEV untuk foto timbangan yang disimpan di disk lokal (FOTO_STORAGE=local).
// Aktif hanya bila NODE_ENV !== "production" DAN sesi super_admin; di produksi selalu 404.
// Modul server dimuat dinamis supaya build tidak mengevaluasi env server.

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const { name } = await params;
  const { sajikanFotoLokal } = await import("@/server/foto/dev-route");
  return sajikanFotoLokal(req, name);
}
