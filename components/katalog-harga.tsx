import { redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { ROUTES, redirectUntukError } from "@/contract";
import { KatalogHargaView } from "@/components/KatalogHargaView";

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
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
        {res.message}
      </div>
    );
  }

  return <KatalogHargaView sesi={sesi} list={res.data} />;
}
