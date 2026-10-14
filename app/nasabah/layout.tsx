import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { queries } from "@/lib/api/queries";
import { ROUTES } from "@/contract";
import { actions } from "@/lib/api/actions";
import { LogOut } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { NavTab, type ItemNav } from "@/components/shell/nav";

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

  const menu: ItemNav[] = [
    { href: "/nasabah", label: "Saldo & Riwayat", ikon: "dashboard" },
    { href: "/nasabah/katalog", label: "Katalog Harga", ikon: "sampah" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/nasabah" className="min-w-0 leading-tight">
            <span className="block text-[0.6875rem] font-medium tracking-wide text-ink-muted uppercase">Bank Sampah</span>
            <span className="block truncate font-semibold text-ink">SBS Rinjani</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-sm text-ink-muted sm:block">{sesi.nama}</span>
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
          </div>
        </div>
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <NavTab items={menu} akar="/nasabah" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="border-t border-line py-4 text-center text-xs text-ink-muted">
        Bank Sampah Rinjani SBS &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
