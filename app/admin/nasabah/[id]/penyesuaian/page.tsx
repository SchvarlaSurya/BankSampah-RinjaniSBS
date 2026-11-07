import { notFound, redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { redirectUntukError } from "@/contract";
import { PenyesuaianForm } from "./penyesuaian-form";
import { Alert } from "@/components/ui/feedback";

export default async function PenyesuaianSaldoPage({
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
      <Alert tone="danger">{res.message}</Alert>
    );
  }

  return <PenyesuaianForm customerId={customerId} nasabah={res.data} />;
}
