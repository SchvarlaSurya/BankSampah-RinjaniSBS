"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { actions } from "@/lib/api/actions";
import { ROUTES, ERROR_MESSAGES } from "@/contract";
import { Recycle, Lock, User, AlertCircle, ArrowRight, Loader2 } from "lucide-react";

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 py-8 selection:bg-emerald-500 selection:text-white relative overflow-x-hidden overflow-y-auto">
      {/* Background Decor */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-teal-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl shadow-emerald-950/20">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow-inner">
              <Recycle className="w-8 h-8 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Bank Sampah Rinjani</h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Sistem Integrasi Digital & Transaksi Sampah (SBS)
            </p>
          </div>

          {/* Global Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{errorMessage}</p>
                {retryCountdown > 0 && (
                  <p className="text-[11px] text-rose-400/80 mt-1">
                    Tombol login dinonaktifkan selama <span className="font-bold">{retryCountdown}</span> detik.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username / ID Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                ID Pengguna / Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  disabled={loading || retryCountdown > 0}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan ID / Username"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 placeholder-slate-600 text-sm rounded-xl pl-10 pr-4 py-3 transition-all outline-none disabled:opacity-50"
                />
              </div>
              {fieldErrors.username && (
                <p className="text-rose-400 text-xs mt-1.5">{fieldErrors.username.join(", ")}</p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  disabled={loading || retryCountdown > 0}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 placeholder-slate-600 text-sm rounded-xl pl-10 pr-4 py-3 transition-all outline-none disabled:opacity-50"
                />
              </div>
              {fieldErrors.password && (
                <p className="text-rose-400 text-xs mt-1.5">{fieldErrors.password.join(", ")}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || retryCountdown > 0}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm rounded-xl py-3 px-4 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : retryCountdown > 0 ? (
                <span>Tunggu ({retryCountdown}s)</span>
              ) : (
                <>
                  <span>Masuk Akun</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Zero-Surprise Integration &bull; Bank Sampah Rinjani SBS
        </p>
      </div>
    </div>
  );
}
