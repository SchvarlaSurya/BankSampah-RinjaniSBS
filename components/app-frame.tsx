import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { RoleNavigation } from "@/components/role-navigation";
import { ROUTES, type SesiInfo } from "@/src/contract";
import { actions } from "@/src/lib/api/actions";

const roleLabel = {
  super_admin: "Super Admin",
  admin: "Admin",
  nasabah: "Nasabah",
} as const;

export function AppFrame({
  children,
  sesi,
}: {
  children: React.ReactNode;
  sesi: SesiInfo;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <a
        href="#konten-utama"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-slate-950"
      >
        Lewati navigasi
      </a>

      <header className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href={ROUTES.home[sesi.role]}
            aria-label="SBS Rinjani Bank Sampah, ke beranda"
            className="block shrink-0 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400"
          >
            <span className="relative block h-[74px] w-[132px] overflow-hidden bg-white sm:h-[88px] sm:w-[160px]">
              <Image
                src="/logo-rinjani.png"
                alt="SBS Rinjani Bank Sampah"
                width={1280}
                height={640}
                priority
                className="absolute left-[-112px] top-[-28px] h-[166px] w-[332px] max-w-none sm:left-[-136px] sm:top-[-34px] sm:h-[200px] sm:w-[400px]"
              />
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold text-white">{sesi.nama}</p>
              <p className="text-xs text-slate-400">{roleLabel[sesi.role]}</p>
            </div>
            <form
              action={async () => {
                "use server";
                await actions.logout();
                redirect(ROUTES.login);
              }}
            >
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-700 px-3 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:px-4"
              >
                <LogOut aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Keluar</span>
                <span className="sr-only sm:hidden">Keluar</span>
              </button>
            </form>
          </div>

          <RoleNavigation role={sesi.role} />
        </div>
      </header>

      <main
        id="konten-utama"
        className={`mx-auto w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 ${sesi.role === "nasabah" ? "max-w-5xl" : "max-w-7xl"}`}
      >
        {children}
      </main>
    </div>
  );
}
