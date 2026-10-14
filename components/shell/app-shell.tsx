import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { LogoSbs } from "@/components/shell/logo";
import { JudulBagian, NavBawah, NavSidebar, type ItemNav } from "@/components/shell/nav";

/**
 * Kerangka dashboard (admin & nasabah), presentasional saja:
 * - Desktop: sidebar kiri #1C211C (logo, menu, profil + aksi akun di bawah).
 * - Header atas minimal: judul bagian + badge role + aksi (ganti password, keluar).
 * - HP/tablet: bottom navigation; tidak ada scroll horizontal.
 * Form logout (server action) & tombol ganti password dikirim dari layout sebagai elemen.
 */
export function AppShell({
  menu,
  akar,
  nama,
  peran,
  nadaPeran,
  aksiSidebar,
  aksiHeader,
  children,
}: {
  menu: ItemNav[];
  akar: string;
  nama: string;
  peran: string;
  nadaPeran: BadgeTone;
  aksiSidebar: React.ReactNode;
  aksiHeader: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar-bg px-3 py-4 lg:flex">
        <Link href={akar} className="mb-6 block rounded-card bg-white px-4 py-3" aria-label="SBS Rinjani, ke beranda">
          <LogoSbs className="mx-auto w-40" priority />
        </Link>

        <NavSidebar items={menu} akar={akar} />

        <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-3 pb-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-sm font-semibold text-white">
              {nama.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{nama}</p>
              <p className="text-xs text-sidebar-text">{peran}</p>
            </div>
          </div>
          {aksiSidebar}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-10">
            <Link href={akar} className="shrink-0 rounded-control bg-white lg:hidden" aria-label="SBS Rinjani, ke beranda">
              <LogoSbs className="w-16" />
            </Link>
            <div className="min-w-0 flex-1">
              <JudulBagian items={menu} akar={akar} />
            </div>
            <Badge tone={nadaPeran} className="hidden sm:inline-flex">
              {peran}
            </Badge>
            <div className="flex items-center gap-1">{aksiHeader}</div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pt-8 lg:pb-10">{children}</main>

        <footer className="hidden border-t border-line px-10 py-4 text-center text-xs text-ink-muted lg:block">
          Bank Sampah Rinjani SBS &copy; {new Date().getFullYear()}
        </footer>
      </div>

      <NavBawah items={menu} akar={akar} />
    </div>
  );
}
