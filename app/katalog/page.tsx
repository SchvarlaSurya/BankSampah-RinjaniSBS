import Link from "next/link";
import { queries } from "@/src/lib/api/queries";
import { KatalogHargaView } from "@/components/KatalogHargaView";
import { Recycle, ArrowLeft, LogIn, LayoutDashboard } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicKatalogPage() {
  const sesi = await queries.getSesi();

  const dashboardHref = sesi
    ? sesi.role === "nasabah"
      ? "/nasabah"
      : "/admin"
    : "/login";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-lg text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Recycle className="w-5 h-5" />
            </div>
            <span>
              Bank Sampah <span className="text-slate-400 text-sm font-medium">Rinjani SBS</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {sesi ? (
              <Link
                href={dashboardHref}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dashboard ({sesi.nama})</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk / Login</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <KatalogHargaView initialSesi={sesi} mode={sesi ? (sesi.role === "nasabah" ? "nasabah" : "admin") : "public"} />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-4 text-center text-xs text-slate-500">
        Bank Sampah Rinjani SBS &copy; {new Date().getFullYear()} &bull; Layanan Terpadu Daur Ulang Berkelanjutan
      </footer>
    </div>
  );
}
