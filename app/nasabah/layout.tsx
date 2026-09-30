import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { ROUTES } from "@/src/contract";
import { queries } from "@/src/lib/api/queries";

export default async function NasabahLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const sesi = await queries.getSesi();

  if (!sesi) redirect(ROUTES.login);
  if (sesi.mustChangePassword) redirect(ROUTES.gantiPassword);
  if (sesi.role !== "nasabah") redirect(ROUTES.home[sesi.role]);

  return <AppFrame sesi={sesi}>{children}</AppFrame>;
}
