import { redirect } from "next/navigation";
import { connection } from "next/server";
import { queries } from "@/src/lib/api/queries";
import { ROUTES } from "@/src/contract";

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
