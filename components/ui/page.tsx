import { cn } from "@/lib/utils";

/** Judul halaman dashboard: eyebrow kecil, judul, deskripsi, aksi di kanan. Inter, bukan condensed. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="text-xs font-semibold tracking-wide text-brand uppercase">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Angka ringkas (saldo, jumlah). Selalu tabular-nums. */
export function Stat({
  label,
  value,
  hint,
  className,
  emphasis = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={cn("font-semibold tracking-tight tabular-nums text-ink", emphasis ? "text-3xl" : "text-xl")}>{value}</p>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

/** Tabel: baris min 44px, header halus, hover lembut, tanpa garis tebal. */
export const tabel = {
  wrap: "overflow-x-auto",
  table: "w-full border-collapse text-sm",
  thead: "bg-surface-muted",
  th: "h-10 px-4 text-left text-xs font-semibold tracking-wide text-ink-muted uppercase whitespace-nowrap",
  tr: "border-t border-line transition-colors duration-150 hover:bg-brand-soft",
  td: "h-11 px-4 py-2.5 align-middle text-ink",
  angka: "text-right tabular-nums whitespace-nowrap",
};

/** Daftar baris (pengganti tabel di layar sempit). */
export const daftar = {
  ul: "divide-y divide-line",
  li: "flex items-center justify-between gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-brand-soft",
};
