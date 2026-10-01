import { notFound, redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { redirectUntukError } from "@/contract";
import { TarikForm } from "./tarik-form";

export default async function TarikTunaiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: customerId } = await params;

  const res = await queries.getNasabah({ customerId });
  if (!res.ok) {
    const redir = redirectUntukError(res.code);
    if (redir) redirect(redir);
    if (res.code === "NASABAH_TIDAK_DITEMUKAN") notFound();
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
        {res.message}
      </div>
    );
  }

  return <TarikForm customerId={customerId} nasabah={res.data} />;
}
