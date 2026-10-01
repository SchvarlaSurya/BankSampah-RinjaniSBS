import { redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { redirectUntukError } from "@/contract";
import { JenisSampahManager } from "./jenis-sampah-manager";

export default async function MasterJenisSampahPage() {
  const res = await queries.listJenisSampah({ termasukNonaktif: true });
  if (!res.ok) {
    const redir = redirectUntukError(res.code);
    if (redir) redirect(redir);
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
        {res.message}
      </div>
    );
  }

  return <JenisSampahManager list={res.data} />;
}
