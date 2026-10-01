"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/contract";

const adminLinks = [
  { href: "/admin", label: "Cari Nasabah", shortLabel: "Cari" },
  { href: "/admin/jenis-sampah", label: "Jenis Sampah", shortLabel: "Jenis" },
  { href: "/admin/pengguna", label: "Pengguna", shortLabel: "Pengguna" },
  { href: "/admin/audit", label: "Audit Transaksi", shortLabel: "Audit" },
] as const;

export function RoleNavigation({ role }: { role: Role }) {
  const pathname = usePathname();
  const links = role === "super_admin" ? adminLinks : role === "admin" ? adminLinks.slice(0, 1) : [
    { href: "/nasabah", label: "Beranda", shortLabel: "Beranda" },
  ];

  return (
    <nav aria-label="Navigasi utama" className="w-full border-t border-slate-800 pt-3">
      <div className={`grid gap-1 ${links.length === 4 ? "grid-cols-4" : "grid-cols-1"} md:flex md:flex-wrap md:gap-2`}>
        {links.map(({ href, label, shortLabel }) => {
          const active = href === "/admin"
            ? pathname === "/admin" || pathname.startsWith("/admin/nasabah/") || pathname.startsWith("/admin/transaksi/")
            : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 min-w-0 items-center justify-center rounded-md px-2 text-center text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 md:px-4 md:text-sm ${active ? "bg-emerald-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
            >
              <span className="md:hidden">{shortLabel}</span>
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
