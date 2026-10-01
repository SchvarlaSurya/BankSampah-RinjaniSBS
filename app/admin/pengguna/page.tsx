import { redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { redirectUntukError } from "@/contract";
import { KelolaPengguna } from "./kelola-pengguna";

export default async function KelolaPenggunaPage() {
  const res = await queries.listStaf();
  if (!res.ok) {
    const redir = redirectUntukError(res.code);
    if (redir) redirect(redir);
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
        {res.message}
      </div>
    );
  }

  return <KelolaPengguna stafList={res.data} />;
}
