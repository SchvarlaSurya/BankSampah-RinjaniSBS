import { redirect } from "next/navigation";
import { connection } from "next/server";
import { queries } from "@/lib/api/queries";
import { ROUTES } from "@/contract";
import { GantiPasswordForm } from "./ganti-password-form";

export default async function GantiPasswordPage() {
  await connection();
  const sesi = await queries.getSesi();
  if (!sesi) redirect(ROUTES.login);

  return <GantiPasswordForm tujuan={ROUTES.home[sesi.role]} />;
}
