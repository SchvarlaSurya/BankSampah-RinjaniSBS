import { redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { ROLES, ROUTES, redirectUntukError, type Role } from "@/contract";
import { KelolaPengguna } from "./kelola-pengguna";

type Params = { [key: string]: string | string[] | undefined };
const teks = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function KelolaPenggunaPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sesi = await queries.getSesi();
  if (!sesi) redirect(ROUTES.login);

  const sp = await searchParams;
  const role = teks(sp.role);
  const status = teks(sp.status);
  const limit = Math.min(Math.max(Number.parseInt(teks(sp.limit) || "20", 10) || 20, 1), 100);
  const page = Math.max(Number.parseInt(teks(sp.page) || "1", 10) || 1, 1);

  const res = await queries.listPengguna({
    search: teks(sp.search) || undefined,
    role: (ROLES as readonly string[]).includes(role) ? (role as Role) : undefined,
    rt: /^\d{1,2}$/.test(teks(sp.rt)) ? teks(sp.rt) : undefined,
    aktif: status === "aktif" ? true : status === "nonaktif" ? false : undefined,
    limit,
    offset: (page - 1) * limit,
  });
  if (!res.ok) {
    const redir = redirectUntukError(res.code);
    if (redir) redirect(redir);
  }

  return <KelolaPengguna sesi={sesi} dataHalaman={res.ok ? res.data : null} tableError={res.ok ? null : res.message} />;
}
