import { notFound, redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { redirectUntukError } from "@/contract";

export const dynamic = "force-dynamic";
import KoreksiDialog from "@/components/koreksi-dialog";
import { TransaksiDetailView } from "@/components/transaksi-detail-view";
import { Alert } from "@/components/ui/feedback";

export default async function TransaksiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [sesi, txRes] = await Promise.all([
    queries.getSesi(),
    queries.getTransaksi({ id }),
  ]);

  if (!sesi) redirect("/login");

  if (!txRes.ok) {
    const redir = redirectUntukError(txRes.code);
    if (redir) redirect(redir);
    if (txRes.code === "TRANSAKSI_TIDAK_DITEMUKAN") notFound();
    return <Alert tone="danger">{txRes.message}</Alert>;
  }

  const tx = txRes.data;
  const isSuperAdmin = sesi.role === "super_admin";

  return (
    <TransaksiDetailView
      tx={tx}
      admin
      kembali={{ href: `/admin/nasabah/${tx.customerId}`, label: "Kembali ke nasabah" }}
      aksi={
        isSuperAdmin && !tx.sudahDibalik && tx.tipe !== "koreksi" ? (
          <div className="flex justify-end">
            <KoreksiDialog transaksiId={tx.id} />
          </div>
        ) : null
      }
    />
  );
}
