import { cn } from "@/lib/utils";

/**
 * Kontrol form. Semua props (name, id, value, onChange, required, ...) diteruskan apa adanya.
 * Tinggi 44px, border >= 3:1, fokus ring primary, keadaan error lewat aria-invalid.
 */
const kontrol =
  "w-full rounded-control border border-line-strong bg-surface px-3.5 text-[0.9375rem] text-ink " +
  "transition-[border-color,box-shadow] duration-150 ease-standard " +
  "focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20 " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted " +
  "aria-invalid:border-danger-fg aria-invalid:focus:ring-danger-fg/20";

export const inputClass = cn(kontrol, "h-11");
export const textareaClass = cn(kontrol, "min-h-24 py-2.5 leading-relaxed");
export const selectClass = cn(kontrol, "h-11 pr-9 appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1rem]");

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(textareaClass, className)} {...props} />;
}

/** Panah select digambar lewat SVG inline (ikon outline, warna ink-muted). */
const panah =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235c635b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Select({ className, style, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(selectClass, className)} style={{ backgroundImage: panah, ...style }} {...props} />;
}

/** Label selalu terlihat + petunjuk + pesan error spesifik di bawah kontrol. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-danger-fg" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger-fg" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
}
