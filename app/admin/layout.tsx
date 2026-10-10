import { redirect } from "next/navigation";
import Link from "next/link";
import { queries } from "@/src/lib/api/queries";
import { ROUTES } from "@/src/contract";
import { actions } from "@/src/lib/api/actions";
import { 
  Recycle, 
  Search, 
  Users, 
  Trash2, 
  FileCheck, 
  LogOut, 
  ShieldCheck, 
  UserCheck 
} from "lucide-react";

import { GantiPasswordModal } from "@/app/nasabah/GantiPasswordModal";

export default async function AdminLayout({
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

  if (sesi.role === "nasabah") {
    redirect(ROUTES.home.nasabah);
  }

  const isSuperAdmin = sesi.role === "super_admin";

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link 
              href="/admin" 
              className="flex items-center gap-2.5 font-bold text-lg text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Recycle className="w-5 h-5" />
              </div>
              <span>Bank Sampah <span className="text-slate-400 text-sm font-medium">Rinjani SBS</span></span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all flex items-center gap-1.5"
              >
                <Search className="w-4 h-4 text-emerald-400" />
                Cari Nasabah
              </Link>
              <Link
                href="/admin/jenis-sampah"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4 text-emerald-400" />
                Jenis Sampah
              </Link>
              <Link
                href="/admin/pengguna"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all flex items-center gap-1.5"
              >
                <Users className="w-4 h-4 text-emerald-400" />
                Pengguna / Nasabah
              </Link>
              {isSuperAdmin && (
                <>
                  <Link
                    href="/admin/audit"
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all flex items-center gap-1.5"
                  >
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    Audit Transaksi
                  </Link>
                  <Link
                    href="/admin/audit-harga"
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all flex items-center gap-1.5"
                  >
                    <FileCheck className="w-4 h-4 text-amber-400" />
                    Audit Harga
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* User badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
              {isSuperAdmin ? (
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="font-semibold text-slate-200">{sesi.nama}</span>
              <span className="text-slate-500 uppercase font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800">
                {sesi.role}
              </span>
            </div>

            {/* Ganti Password Modal */}
            <GantiPasswordModal />

            {/* Logout button */}
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

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-slate-800/60 px-4 py-2 flex items-center justify-around text-xs">
          <Link
            href="/admin"
            className="flex flex-col items-center gap-1 text-slate-300 hover:text-emerald-400 p-1"
          >
            <Search className="w-4 h-4" />
            <span>Cari</span>
          </Link>
          <Link
            href="/admin/jenis-sampah"
            className="flex flex-col items-center gap-1 text-slate-300 hover:text-emerald-400 p-1"
          >
            <Trash2 className="w-4 h-4" />
            <span>Sampah</span>
          </Link>
          <Link
            href="/admin/pengguna"
            className="flex flex-col items-center gap-1 text-slate-300 hover:text-emerald-400 p-1"
          >
            <Users className="w-4 h-4" />
            <span>Nasabah</span>
          </Link>
          {isSuperAdmin && (
            <>
              <Link
                href="/admin/audit"
                className="flex flex-col items-center gap-1 text-slate-300 hover:text-emerald-400 p-1"
              >
                <FileCheck className="w-4 h-4" />
                <span>Audit Tx</span>
              </Link>
              <Link
                href="/admin/audit-harga"
                className="flex flex-col items-center gap-1 text-slate-300 hover:text-amber-400 p-1"
              >
                <FileCheck className="w-4 h-4 text-amber-400" />
                <span>Log Harga</span>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-4 text-center text-xs text-slate-500">
        Bank Sampah Rinjani SBS &copy; {new Date().getFullYear()} &bull; Zero-Surprise Architecture
      </footer>
    </div>
  );
}
