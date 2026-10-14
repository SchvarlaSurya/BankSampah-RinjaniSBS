import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, RotateCcw, SlidersHorizontal } from "lucide-react";
import { formatRupiah, type TipeTransaksi, type TransaksiRingkas } from "@/contract";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Pemetaan TAMPILAN per tipe transaksi (label, ikon, nada badge). Bukan logika bisnis. */
export const TAMPILAN_TIPE: Record<TipeTransaksi, { label: string; Ikon: typeof ArrowDownLeft; nada: BadgeTone }> = {
  setor: { label: "Setor", Ikon: ArrowDownLeft, nada: "success" },
  tarik: { label: "Tarik", Ikon: ArrowUpRight, nada: "warning" },
  koreksi: { label: "Koreksi", Ikon: RotateCcw, nada: "danger" },
  penyesuaian: { label: "Penyesuaian", Ikon: SlidersHorizontal, nada: "info" },
};

const latarIkon: Record<BadgeTone, string> = {
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-info-fg",
  neutral: "bg-surface-muted text-ink-muted",
  brand: "bg-brand-soft text-brand-hover",
};

export function IkonTipe({ tipe, besar = false }: { tipe: TipeTransaksi; besar?: boolean }) {
  const { Ikon, nada } = TAMPILAN_TIPE[tipe];
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full", besar ? "size-12" : "size-10", latarIkon[nada])}>
      <Ikon className={besar ? "size-5" : "size-4"} aria-hidden="true" />
    </span>
  );
}

export function BadgeTipe({ tipe }: { tipe: TipeTransaksi }) {
  const { label, nada } = TAMPILAN_TIPE[tipe];
  return <Badge tone={nada}>{label}</Badge>;
}

/** Jumlah bertanda: + hijau tua, - teks utama (bukan merah, supaya tidak terasa "error"). */
export function JumlahTransaksi({ jumlah, className }: { jumlah: number; className?: string }) {
  return (
    <span className={cn("font-semibold tabular-nums whitespace-nowrap", jumlah > 0 ? "text-success-fg" : "text-ink", className)}>
      {jumlah > 0 ? "+" : ""}
      {formatRupiah(jumlah)}
    </span>
  );
}

export const formatWaktuWib = (iso: string) =>
  `${new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })} WIB`;

/** Satu baris riwayat transaksi yang seluruhnya bisa diklik. */
export function BarisTransaksi({ tx, href }: { tx: TransaksiRingkas; href: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-16 items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-brand-soft focus-visible:bg-brand-soft sm:gap-4"
      >
        <IkonTipe tipe={tx.tipe} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{TAMPILAN_TIPE[tx.tipe].label}</span>
            {tx.sudahDibalik && <Badge tone="danger">Dibalik</Badge>}
          </span>
          <span className="block truncate text-sm text-ink-muted">{tx.catatan || `Diproses oleh ${tx.dibuatOlehNama}`}</span>
          <span className="block text-xs text-ink-subtle">{formatWaktuWib(tx.waktu)}</span>
        </span>
        <JumlahTransaksi jumlah={tx.jumlah} />
        <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
      </Link>
    </li>
  );
}
