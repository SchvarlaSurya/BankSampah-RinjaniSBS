import { redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { redirectUntukError, TIPE_TRANSAKSI, type TipeTransaksi } from "@/contract";
import { AuditView, type FilterAudit } from "./audit-view";
import { Alert } from "@/components/ui/feedback";

type Params = { [key: string]: string | string[] | undefined };
const teks = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function AuditTransaksiPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const tipe = teks(sp.tipe);
  const filter: FilterAudit = {
    adminId: teks(sp.admin),
    tipe: (TIPE_TRANSAKSI as readonly string[]).includes(tipe) ? (tipe as TipeTransaksi) : "",
    dari: teks(sp.dari),
    sampai: teks(sp.sampai),
  };
  const cursor = teks(sp.cursor) || undefined;
  const jejak = teks(sp.jejak).split(",").filter((c) => c === "-" || /^\d{1,18}$/.test(c));

  const stafRes = await queries.listStaf();
  if (!stafRes.ok) {
    const redir = redirectUntukError(stafRes.code);
    if (redir) redirect(redir);
    return (
      <Alert tone="danger">{stafRes.message}</Alert>
    );
  }

  const res = await queries.auditTransaksi({
    adminId: filter.adminId || undefined,
    tipe: filter.tipe || undefined,
    dari: filter.dari || undefined,
    sampai: filter.sampai || undefined,
    cursor,
    limit: 20,
  });
  if (!res.ok) {
    const redir = redirectUntukError(res.code);
    if (redir) redirect(redir);
  }

  return (
    <AuditView
      stafList={stafRes.data}
      auditItems={res.ok ? res.data.items : []}
      nextCursor={res.ok ? res.data.nextCursor : null}
      filter={filter}
      cursor={cursor}
      jejak={jejak}
      errorMessage={res.ok ? null : res.message}
    />
  );
}
