import { redirect } from "next/navigation";
import Link from "next/link";
import { queries } from "@/src/lib/api/queries";
import { ROUTES } from "@/src/contract";
import { actions } from "@/src/lib/api/actions";
import { Recycle, LogOut, Wallet } from "lucide-react";

export default async function NasabahLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/nasabah"
            className="flex items-center gap-2.5 font-bold text-lg text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Recycle className="w-5 h-5" />
            </div>
            <span>Bank Sampah <span className="text-slate-400 text-sm font-medium">Rinjani SBS</span></span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-200">{sesi.nama}</span>
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
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors text-xs font-medium flex items-center gap-1.5"
                title="Keluar / Logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-4 text-center text-xs text-slate-500">
        Bank Sampah Rinjani SBS &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
