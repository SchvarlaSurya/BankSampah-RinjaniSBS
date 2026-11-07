"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actions } from "@/lib/api/actions";
import { ERROR_MESSAGES, LIMIT } from "@/contract";
import { KeyRound, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { LogoSbs } from "@/components/shell/logo";

/** `tujuan` = halaman beranda role pengguna, ditentukan Server Component (page.tsx). */
export function GantiPasswordForm({ tujuan }: { tujuan: string }) {
  const router = useRouter();
  const [passwordLama, setPasswordLama] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasi, setKonfirmasi] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErrorMessage(null);
    setFieldErrors({});

    try {
      const res = await actions.gantiPassword({
        passwordLama,
        passwordBaru,
        konfirmasi,
      });

      if (!res.ok) {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
          const firstMsg = Object.values(res.fieldErrors).flat()[0];
          setErrorMessage(firstMsg || res.message || ERROR_MESSAGES[res.code]);
        } else {
          setErrorMessage(res.message || ERROR_MESSAGES[res.code]);
        }
      } else {
        router.push(tujuan);
      }
    } catch {
      setErrorMessage(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <LogoSbs className="w-40" priority />
        </div>

        <section className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-bg text-warning-fg">
              <KeyRound className="size-5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-ink">Wajib ganti password</h1>
              <p className="text-sm text-ink-muted">
                Untuk keamanan akun Anda, silakan buat password baru (minimal {LIMIT.PASSWORD_MIN} karakter).
              </p>
            </div>
          </div>

          {errorMessage && <Alert tone="danger" className="mb-5">{errorMessage}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Password saat ini / sementara" htmlFor="gpw-lama" error={fieldErrors.passwordLama?.join(", ")}>
              <div className="relative">
                <input
                  id="gpw-lama"
                  type={showOld ? "text" : "password"}
                  required
                  disabled={loading}
                  value={passwordLama}
                  onChange={(e) => {
                    setPasswordLama(e.target.value);
                    if (errorMessage || fieldErrors.passwordLama) {
                      setErrorMessage(null);
                      setFieldErrors((prev) => { const n = { ...prev }; delete n.passwordLama; return n; });
                    }
                  }}
                  placeholder="Masukkan password saat ini"
                  autoComplete="current-password"
                  aria-invalid={fieldErrors.passwordLama ? true : undefined}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  aria-label={showOld ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-control text-ink-muted hover:text-ink"
                >
                  {showOld ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <Field label="Password baru" htmlFor="gpw-baru" error={fieldErrors.passwordBaru?.join(", ")}>
              <div className="relative">
                <input
                  id="gpw-baru"
                  type={showNew ? "text" : "password"}
                  required
                  disabled={loading}
                  value={passwordBaru}
                  onChange={(e) => {
                    setPasswordBaru(e.target.value);
                    if (errorMessage || fieldErrors.passwordBaru) {
                      setErrorMessage(null);
                      setFieldErrors((prev) => { const n = { ...prev }; delete n.passwordBaru; return n; });
                    }
                  }}
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                  aria-invalid={fieldErrors.passwordBaru ? true : undefined}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  aria-label={showNew ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-control text-ink-muted hover:text-ink"
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <Field label="Konfirmasi password baru" htmlFor="gpw-konfirmasi" error={fieldErrors.konfirmasi?.join(", ")}>
              <div className="relative">
                <input
                  id="gpw-konfirmasi"
                  type={showConfirm ? "text" : "password"}
                  required
                  disabled={loading}
                  value={konfirmasi}
                  onChange={(e) => {
                    setKonfirmasi(e.target.value);
                    if (errorMessage || fieldErrors.konfirmasi) {
                      setErrorMessage(null);
                      setFieldErrors((prev) => { const n = { ...prev }; delete n.konfirmasi; return n; });
                    }
                  }}
                  placeholder="Ketik ulang password baru"
                  autoComplete="new-password"
                  aria-invalid={fieldErrors.konfirmasi ? true : undefined}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-control text-ink-muted hover:text-ink"
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  <span>Menyimpan password…</span>
                </>
              ) : (
                <>
                  <span>Simpan & lanjutkan</span>
                  <ArrowRight />
                </>
              )}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
