"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { actions } from "@/lib/api/actions";
import { ROUTES, ERROR_MESSAGES } from "@/contract";
import { Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [retryCountdown, setRetryCountdown] = useState<number>(0);

  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = setInterval(() => {
      setRetryCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [retryCountdown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (retryCountdown > 0 || loading) return;

    setLoading(true);
    setErrorMessage(null);
    setFieldErrors({});

    try {
      const res = await actions.login({ username, password });
      if (!res.ok) {
        if (res.code === "TERLALU_BANYAK_PERCOBAAN" && res.retryAfterDetik) {
          setRetryCountdown(res.retryAfterDetik);
        }
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        setErrorMessage(res.message || ERROR_MESSAGES[res.code]);
      } else {
        const sesi = res.data;
        if (sesi.mustChangePassword) {
          router.push(ROUTES.gantiPassword);
        } else {
          router.push(ROUTES.home[sesi.role]);
        }
      }
    } catch {
      setErrorMessage(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      {/* Blok merek (publik, ekspresif): hijau tua, judul condensed senada wordmark logo. */}
      <section className="relative overflow-hidden bg-brand-deep text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between">
        <div className="relative z-10 px-6 pt-7 pb-16 sm:px-10 sm:pt-10 sm:pb-20 lg:px-14 lg:pt-14">
          <p className="text-sm font-medium tracking-[0.2em] text-white/80 uppercase">Bank Sampah</p>
          <p className="font-display text-2xl leading-none font-bold tracking-wide uppercase sm:text-3xl">SBS Rinjani</p>

          <h1 className="mt-6 max-w-md font-display text-4xl leading-[0.95] font-extrabold tracking-tight uppercase sm:mt-10 sm:text-6xl lg:mt-24 lg:text-7xl">
            Sampah terpilah, saldo tercatat.
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85 sm:mt-5 sm:text-base">
            Setiap setoran ditimbang, difoto, dan dicatat. Nasabah bisa melihat saldo dan riwayatnya kapan saja.
          </p>
        </div>

        {/* Motif atap/gunung dari logo sebagai pemisah bagian. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 600 120"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-16 w-full text-canvas lg:hidden"
        >
          <path d="M0 120 L0 92 L230 18 L262 44 L330 0 L600 92 L600 120 Z" fill="currentColor" />
        </svg>
        <svg
          aria-hidden="true"
          viewBox="0 0 600 220"
          className="hidden w-full text-white/10 lg:block"
        >
          <path d="M0 220 L230 70 L262 104 L330 30 L600 220 Z" fill="currentColor" />
          <path d="M0 220 L230 70 L262 104 L330 30 L600 220" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </section>

      {/* Form masuk */}
      <section className="flex flex-1 items-start justify-center px-4 pb-12 sm:px-6 lg:items-center lg:py-12">
        <div className="-mt-6 w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card sm:p-8 lg:mt-0">
          <div className="mb-6 space-y-1">
            <h2 className="text-xl font-semibold text-ink">Masuk ke akun</h2>
            <p className="text-sm text-ink-muted">Gunakan ID dan password yang diberikan petugas bank sampah.</p>
          </div>

          {errorMessage && (
            <Alert tone="danger" className="mb-5">
              <p className="font-medium">{errorMessage}</p>
              {retryCountdown > 0 && (
                <p className="mt-1">
                  Coba lagi dalam <span className="font-semibold tabular-nums">{retryCountdown}</span> detik.
                </p>
              )}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="ID / Username" htmlFor="login-username" error={fieldErrors.username?.join(", ")}>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
                <input
                  id="login-username"
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  disabled={loading || retryCountdown > 0}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan ID / Username"
                  aria-invalid={fieldErrors.username ? true : undefined}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </Field>

            <Field label="Password" htmlFor="login-password" error={fieldErrors.password?.join(", ")}>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  disabled={loading || retryCountdown > 0}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  aria-invalid={fieldErrors.password ? true : undefined}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </Field>

            <Button type="submit" variant="accent" size="lg" disabled={loading || retryCountdown > 0} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  <span>Memproses…</span>
                </>
              ) : retryCountdown > 0 ? (
                <span className="tabular-nums">Tunggu {retryCountdown} detik</span>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 border-t border-line pt-4 text-sm text-ink-muted">
            Lupa password? Hubungi petugas atau super admin bank sampah untuk mendapat password sementara.
          </p>
        </div>
      </section>
    </div>
  );
}
