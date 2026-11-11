import { redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { ROUTES } from "@/contract";
import { AkunSaya } from "@/components/akun/akun-saya";

export default async function AkunSayaPage() {
  const sesi = await queries.getSesi();
  if (!sesi) redirect(ROUTES.login);
  return <AkunSaya sesi={sesi} />;
}
