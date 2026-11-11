import { redirect } from "next/navigation";
import { connection } from "next/server";
import { queries } from "@/lib/api/queries";
import { ROUTES } from "@/contract";
import { actions } from "@/lib/api/actions";
import { LogOut } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { AppShell } from "@/components/shell/app-shell";
import type { ItemNav } from "@/components/shell/nav";
import { GantiPasswordModal } from "@/app/nasabah/GantiPasswordModal";

export default async function NasabahLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const sesi = await queries.getSesi();

  if (!sesi) {
    redirect(ROUTES.login);
  }

  if (sesi.mustChangePassword) {
    redirect(ROUTES.gantiPassword);
  }

  if (sesi.role !== "nasabah") {
    redirect(ROUTES.home[sesi.role]);
  }

  // Item, urutan, dan tujuan menu sama persis dengan versi sebelumnya.
  const menu: ItemNav[] = [
    { href: "/nasabah", label: "Dashboard", labelPendek: "Dashboard", ikon: "dashboard" },
    { href: "/nasabah/katalog", label: "Katalog Harga", labelPendek: "Katalog", ikon: "sampah" },
  ];

  return (
    <AppShell
      menu={menu}
      akar="/nasabah"
      nama={sesi.nama}
      userId={sesi.userId}
      fotoVersi={sesi.fotoVersi}
      akunHref="/nasabah/akun"
      peran="Nasabah"
      nadaPeran="info"
      aksiSidebar={<GantiPasswordModal varian="sidebar" />}
      aksiHeader={
        <>
          <form
          action={async () => {
            "use server";
            await actions.logout();
            redirect(ROUTES.login);
          }}
        >
          <button type="submit" className={buttonClass("ghost")} title="Keluar">
            <LogOut aria-hidden="true" />
            <span className="hidden sm:inline">Keluar</span>
            <span className="sr-only sm:hidden">Keluar</span>
          </button>
        </form>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
