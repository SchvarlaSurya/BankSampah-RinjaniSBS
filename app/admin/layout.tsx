import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { queries } from "@/lib/api/queries";
import { ROUTES } from "@/contract";
import { actions } from "@/lib/api/actions";
import { LogOut, ShieldCheck, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { NavSidebar, NavTab, type ItemNav } from "@/components/shell/nav";

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

  const menu: ItemNav[] = [
    { href: "/admin", label: "Cari Nasabah", ikon: "cari" },
    { href: "/admin/jenis-sampah", label: "Jenis Sampah", ikon: "sampah" },
    { href: "/admin/pengguna", label: "Pengguna", ikon: "pengguna" },
    ...(isSuperAdmin
      ? ([
          { href: "/admin/audit", label: "Audit Transaksi", ikon: "audit" },
          { href: "/admin/audit-harga", label: "Audit Harga", ikon: "harga" },
        ] as ItemNav[])
      : []),
  ];

  const keluar = (
    <form
      action={async () => {
        "use server";
        await actions.logout();
        redirect(ROUTES.login);
      }}
    >
      <button
        type="submit"
        className="flex h-10 w-full items-center gap-3 rounded-control px-3 text-sm font-medium text-sidebar-text transition-colors duration-150 hover:bg-sidebar-active hover:text-sidebar-text-active"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Keluar
      </button>
    </form>
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar-bg px-3 py-5 lg:flex">
        <Link href="/admin" className="mb-6 block rounded-control px-3 py-1">
          <span className="block text-xs font-medium tracking-wide text-sidebar-text uppercase">Bank Sampah</span>
          <span className="block text-lg font-semibold text-white">SBS Rinjani</span>
        </Link>

        <NavSidebar items={menu} akar="/admin" />

        <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-3 pb-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-sm font-semibold text-white">
              {sesi.nama.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{sesi.nama}</p>
              <p className="flex items-center gap-1 text-xs text-sidebar-text">
                {isSuperAdmin ? <ShieldCheck className="size-3.5" aria-hidden="true" /> : <UserCheck className="size-3.5" aria-hidden="true" />}
                {isSuperAdmin ? "Super Admin" : "Admin"}
              </p>
            </div>
          </div>
          <GantiPasswordModal varian="sidebar" />
          {keluar}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header (HP & tablet) */}
        <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link href="/admin" className="min-w-0 leading-tight">
              <span className="block text-[0.6875rem] font-medium tracking-wide text-ink-muted uppercase">Bank Sampah</span>
              <span className="block truncate font-semibold text-ink">SBS Rinjani</span>
            </Link>
            <div className="flex items-center gap-2">
              <Badge tone={isSuperAdmin ? "warning" : "brand"}>{isSuperAdmin ? "Super Admin" : "Admin"}</Badge>
              <GantiPasswordModal varian="ikon" />
              <form
                action={async () => {
                  "use server";
                  await actions.logout();
                  redirect(ROUTES.login);
                }}
              >
                <button type="submit" className={buttonClass("ghost", "icon")} aria-label="Keluar">
                  <LogOut aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
          <div className="px-4">
            <NavTab items={menu} akar="/admin" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>

        <footer className="border-t border-line px-4 py-4 text-center text-xs text-ink-muted sm:px-6 lg:px-10">
          Bank Sampah Rinjani SBS &copy; {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
