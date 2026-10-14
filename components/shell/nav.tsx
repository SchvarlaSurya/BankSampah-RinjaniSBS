"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileClock, FileSearch, LayoutDashboard, Search, Tag, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navigasi shell (presentasional). Hanya membaca pathname untuk menandai menu aktif.
 * Ikon dipilih lewat kunci string karena komponen ikon tidak bisa dikirim dari Server Component.
 */
const IKON = {
  cari: Search,
  sampah: Tag,
  pengguna: Users,
  audit: FileSearch,
  harga: FileClock,
  dashboard: LayoutDashboard,
} as const;

/** label = teks menu desktop; labelPendek = teks bottom navigation (HP). */
export type ItemNav = { href: string; label: string; labelPendek: string; ikon: keyof typeof IKON };

function aktif(pathname: string, href: string, akar: string) {
  if (href === akar) {
    // Beranda juga aktif di halaman turunan nasabah/transaksi yang tidak punya menu sendiri.
    return pathname === akar || pathname.startsWith(`${akar}/nasabah/`) || pathname.startsWith(`${akar}/transaksi/`);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Sidebar gelap (desktop). */
export function NavSidebar({ items, akar }: { items: ItemNav[]; akar: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu utama" className="space-y-1">
      {items.map(({ href, label, ikon }) => {
        const Ikon = IKON[ikon];
        const sedang = aktif(pathname, href, akar);
        return (
          <Link
            key={href}
            href={href}
            aria-current={sedang ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150",
              sedang ? "bg-sidebar-active text-sidebar-text-active" : "text-sidebar-text hover:bg-sidebar-active/60 hover:text-sidebar-text-active",
            )}
          >
            <Ikon className={cn("size-4 shrink-0", sedang && "text-brand-bright")} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom navigation (HP & tablet). Semua item muat tanpa scroll horizontal. */
export function NavBawah({ items, akar }: { items: ItemNav[]; akar: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Menu utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ href, labelPendek, ikon }) => {
          const Ikon = IKON[ikon];
          const sedang = aktif(pathname, href, akar);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={sedang ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 px-1 text-xs font-medium transition-colors duration-150",
                  sedang ? "text-brand" : "text-ink-muted hover:text-ink",
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", sedang && "bg-brand-soft")}>
                  <Ikon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="max-w-full truncate">{labelPendek}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Judul bagian di header atas = label menu yang sedang aktif. */
export function JudulBagian({ items, akar }: { items: ItemNav[]; akar: string }) {
  const pathname = usePathname();
  const item = items.find(({ href }) => aktif(pathname, href, akar));
  return <h1 className="truncate text-base font-semibold text-ink">{item?.label ?? items[0]?.label}</h1>;
}
