import { queries } from "@/src/lib/api/queries";
import { KatalogHargaView } from "@/components/KatalogHargaView";

export const dynamic = "force-dynamic";

export default async function AdminJenisSampahPage() {
  const sesi = await queries.getSesi();

  return (
    <div className="py-2">
      <KatalogHargaView initialSesi={sesi} mode="admin" />
    </div>
  );
}
