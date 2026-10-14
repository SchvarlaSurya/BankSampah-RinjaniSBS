import { cn } from "@/lib/utils";

/** Badge status. Selalu berisi teks (bukan warna saja) supaya aman untuk buta warna. */
export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

const nada: Record<BadgeTone, string> = {
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-info-fg",
  neutral: "bg-surface-muted text-ink-muted ring-1 ring-inset ring-line",
  brand: "bg-brand-soft text-brand-hover",
};

export function Badge({ tone = "neutral", className, ...props }: React.ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3.5",
        nada[tone],
        className,
      )}
      {...props}
    />
  );
}
