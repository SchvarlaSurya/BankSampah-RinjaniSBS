import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { ROUTES } from "@/contract";
import { queries } from "@/lib/api/queries";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const sesi = await queries.getSesi();

  if (!sesi) redirect(ROUTES.login);
  if (sesi.mustChangePassword) redirect(ROUTES.gantiPassword);
  if (sesi.role === "nasabah") redirect(ROUTES.home.nasabah);

  return <AppFrame sesi={sesi}>{children}</AppFrame>;
}
