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

export type ItemNav = { href: string; label: string; ikon: keyof typeof IKON };

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
            <Ikon className={cn("size-4 shrink-0", sedang && "text-brand-bright")} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Tab horizontal yang bisa digeser (HP/tablet, dan header nasabah). */
export function NavTab({ items, akar, className }: { items: ItemNav[]; akar: string; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu utama" className={cn("-mx-4 overflow-x-auto px-4", className)}>
      <ul className="flex min-w-max gap-1">
        {items.map(({ href, label, ikon }) => {
          const Ikon = IKON[ikon];
          const sedang = aktif(pathname, href, akar);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={sedang ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors duration-150",
                  sedang ? "border-brand text-ink" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                <Ikon className="size-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
