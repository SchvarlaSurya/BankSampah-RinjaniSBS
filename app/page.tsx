import { redirect } from "next/navigation";
import { connection } from "next/server";
import { queries } from "@/lib/api/queries";
import { ROUTES } from "@/contract";

export default async function HomePage() {
  await connection();
  const sesi = await queries.getSesi();

  if (!sesi) {
    redirect(ROUTES.login);
  }

  if (sesi.mustChangePassword) {
    redirect(ROUTES.gantiPassword);
  }

  redirect(ROUTES.home[sesi.role]);
}
