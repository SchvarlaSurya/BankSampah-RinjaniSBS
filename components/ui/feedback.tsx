import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pesan status di dalam halaman (bukan toast). Ikon + teks, bukan warna saja. */
type AlertTone = "success" | "warning" | "danger" | "info";

const gaya: Record<AlertTone, { kelas: string; Ikon: typeof Info }> = {
  success: { kelas: "bg-success-bg text-success-fg", Ikon: CheckCircle2 },
  warning: { kelas: "bg-warning-bg text-warning-fg", Ikon: TriangleAlert },
  danger: { kelas: "bg-danger-bg text-danger-fg", Ikon: AlertCircle },
  info: { kelas: "bg-info-bg text-info-fg", Ikon: Info },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  action,
}: {
  tone?: AlertTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const { kelas, Ikon } = gaya[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-control px-4 py-3 text-sm", kelas, className)}
    >
      <Ikon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Keadaan kosong: ikon, judul, penjelasan singkat. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 text-ink-subtle [&_svg]:size-8">{icon}</div>}
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Kerangka modal: overlay + panel. Logika buka/tutup tetap di komponen pemanggil. */
export function ModalShell({
  labelledBy,
  children,
  className,
}: {
  labelledBy: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          "max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-card border border-line bg-surface p-6 shadow-overlay",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
