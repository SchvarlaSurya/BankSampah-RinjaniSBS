import { redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { ROUTES, redirectUntukError } from "@/contract";
import { KatalogHargaView } from "@/components/KatalogHargaView";
import { Alert } from "@/components/ui/feedback";

/**
 * Server Component: baca sesi + katalog, lalu kirim ke KatalogHargaView (client) lewat props.
 * Staf melihat juga jenis nonaktif dan harga jual; nasabah hanya yang aktif.
 */
export async function KatalogHarga() {
  const sesi = await queries.getSesi();
  if (!sesi) redirect(ROUTES.login);

  const res = await queries.listJenisSampah({ termasukNonaktif: sesi.role !== "nasabah" });
  if (!res.ok) {
    const redir = redirectUntukError(res.code);
    if (redir) redirect(redir);
    return (
      <Alert tone="danger">{res.message}</Alert>
    );
  }

  return <KatalogHargaView sesi={sesi} list={res.data} />;
}
