import { cn } from "@/lib/utils";

/**
 * Tombol. Aturan: satu tombol primary per area; sisanya secondary/ghost.
 * buttonClass() dipakai juga untuk <Link> yang tampil sebagai tombol.
 * Tinggi minimal 40px (target sentuh).
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
export type ButtonSize = "md" | "lg" | "icon";

const dasar =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-semibold " +
  "transition-colors duration-150 ease-standard select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand " +
  "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const varian: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover",
  secondary:
    "border border-button-secondary-border bg-button-secondary-bg text-ink hover:bg-button-secondary-hover",
  ghost: "text-ink-muted hover:bg-surface-muted hover:text-ink",
  danger: "bg-danger-fg text-white hover:brightness-95",
  // Khusus halaman publik: CTA utama berwarna hangat.
  accent: "bg-accent-warm text-on-accent-warm hover:brightness-95",
};

const ukuran: Record<ButtonSize, string> = {
  md: "h-10 px-4",
  lg: "h-12 px-5 text-[0.9375rem]",
  icon: "size-10",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(dasar, varian[variant], ukuran[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}
