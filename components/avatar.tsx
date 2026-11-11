import { cn } from "@/lib/utils";

/** Inisial dari nama: dua kata pertama ("Sri Rahayu" -> "SR"), satu kata -> satu huruf. */
export function inisialNama(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean);
  const huruf = kata.slice(0, 2).map((k) => k.charAt(0).toUpperCase());
  return huruf.join("") || "?";
}

const UKURAN = {
  sm: "size-9 text-sm",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-24 text-2xl",
} as const;

/** Lingkaran inisial nama. Teks alternatif dari nama (bukan hanya warna). */
export function Avatar({
  nama,
  ukuran = "md",
  className,
}: {
  nama: string;
  ukuran?: keyof typeof UKURAN;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={nama}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted font-semibold text-ink ring-1 ring-line ring-inset select-none",
        UKURAN[ukuran],
        className,
      )}
    >
      <span aria-hidden="true">{inisialNama(nama)}</span>
    </span>
  );
}
