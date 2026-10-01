import { notFound, redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { redirectUntukError } from "@/contract";
import { SetorForm } from "./setor-form";

export default async function SetorSampahPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: customerId } = await params;

  const [nRes, jsRes] = await Promise.all([
    queries.getNasabah({ customerId }),
    queries.listJenisSampah({ termasukNonaktif: false }),
  ]);
  for (const res of [nRes, jsRes]) {
    if (res.ok) continue;
    const redir = redirectUntukError(res.code);
    if (redir) redirect(redir);
    if (res.code === "NASABAH_TIDAK_DITEMUKAN") notFound();
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
        {res.message}
      </div>
    );
  }
  if (!nRes.ok || !jsRes.ok) return null;

  return <SetorForm customerId={customerId} nasabah={nRes.data} jenisSampahList={jsRes.data} />;
}
