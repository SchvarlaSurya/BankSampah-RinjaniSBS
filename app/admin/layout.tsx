import { redirect } from "next/navigation";
import { connection } from "next/server";
import { queries } from "@/lib/api/queries";
import { ROUTES } from "@/contract";
import { actions } from "@/lib/api/actions";
import { LogOut } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { AppShell } from "@/components/shell/app-shell";
import type { ItemNav } from "@/components/shell/nav";
import { PresenceHeartbeat } from "@/components/aktivitas/presence-heartbeat";

import { GantiPasswordModal } from "@/app/nasabah/GantiPasswordModal";

export default async function AdminLayout({
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

  if (sesi.role === "nasabah") {
    redirect(ROUTES.home.nasabah);
  }

  const isSuperAdmin = sesi.role === "super_admin";

  // Item, urutan, dan tujuan menu sama persis dengan versi sebelumnya.
  const menu: ItemNav[] = [
    { href: "/admin", label: "Cari Nasabah", labelPendek: "Cari", ikon: "cari" },
    { href: "/admin/jenis-sampah", label: "Jenis Sampah", labelPendek: "Sampah", ikon: "sampah" },
    { href: "/admin/pengguna", label: "Pengguna / Nasabah", labelPendek: "Nasabah", ikon: "pengguna" },
    ...(isSuperAdmin
      ? ([
          { href: "/admin/audit", label: "Audit Transaksi", labelPendek: "Audit Tx", ikon: "audit" },
          { href: "/admin/audit-harga", label: "Audit Harga", labelPendek: "Log Harga", ikon: "harga" },
        ] as ItemNav[])
      : []),
  ];

  return (
    <AppShell
      menu={menu}
      akar="/admin"
      nama={sesi.nama}
      peran={isSuperAdmin ? "Super Admin" : "Admin"}
      nadaPeran={isSuperAdmin ? "warning" : "brand"}
      aksiSidebar={<GantiPasswordModal varian="sidebar" />}
      aksiHeader={
        <>
          <div className="lg:hidden">
            <GantiPasswordModal varian="ikon" />
          </div>
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
      <PresenceHeartbeat />
      {children}
    </AppShell>
  );
}
