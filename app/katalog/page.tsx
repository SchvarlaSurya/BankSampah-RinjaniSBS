import Link from "next/link";
import { queries } from "@/lib/api/queries";
import { KatalogHarga } from "@/components/katalog-harga";
import { LogIn, LayoutDashboard } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PublicKatalogPage() {
  const sesi = await queries.getSesi();

  const dashboardHref = sesi
    ? sesi.role === "nasabah"
      ? "/nasabah"
      : "/admin"
    : "/login";

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="min-w-0 leading-tight">
            <span className="block text-[0.6875rem] font-medium tracking-wide text-ink-muted uppercase">Bank Sampah</span>
            <span className="block truncate font-semibold text-ink">SBS Rinjani</span>
          </Link>
          {sesi ? (
            <Link href={dashboardHref} className={buttonClass("secondary")}>
              <LayoutDashboard aria-hidden="true" />
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sr-only sm:hidden">Dashboard</span>
            </Link>
          ) : (
            <Link href="/login" className={buttonClass("primary")}>
              <LogIn aria-hidden="true" />
              Masuk
            </Link>
          )}
        </div>
      </header>

      {/* Pita merek (publik): judul condensed di atas hijau tua, motif atap dari logo. */}
      <section className="relative overflow-hidden bg-brand-deep text-white">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-14 sm:px-6 sm:pt-12 sm:pb-20">
          <p className="text-sm font-medium tracking-[0.2em] text-white/80 uppercase">Harga beli per kilogram</p>
          <h1 className="mt-2 font-display text-4xl leading-[0.95] font-extrabold tracking-tight uppercase sm:text-6xl">
            Katalog harga sampah
          </h1>
        </div>
        <svg aria-hidden="true" viewBox="0 0 600 60" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-8 w-full text-canvas sm:h-12">
          <path d="M0 60 L0 46 L230 9 L262 22 L330 0 L600 46 L600 60 Z" fill="currentColor" />
        </svg>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Katalog butuh login: semua query backend memeriksa sesi (belum ada katalog publik). */}
        <KatalogHarga />
      </main>

      <footer className="border-t border-line py-4 text-center text-xs text-ink-muted">
        Bank Sampah Rinjani SBS &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
