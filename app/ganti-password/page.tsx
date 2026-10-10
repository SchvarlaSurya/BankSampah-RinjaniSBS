"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actions } from "@/src/lib/api/actions";
import { queries } from "@/src/lib/api/queries";
import { ROUTES, ERROR_MESSAGES, LIMIT } from "@/src/contract";
import { KeyRound, Lock, AlertCircle, CheckCircle2, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function GantiPasswordPage() {
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
        const sesi = await queries.getSesi();
        if (sesi) {
          router.push(ROUTES.home[sesi.role]);
        } else {
          router.push(ROUTES.login);
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
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
              <KeyRound className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Wajib Ganti Password</h1>
            <p className="text-xs text-slate-400 mt-1">
              Untuk keamanan akun Anda, silakan buat password baru (minimal {LIMIT.PASSWORD_MIN} karakter).
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="font-semibold">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password Lama */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password Saat Ini / Sementara
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
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
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-100 placeholder-slate-600 text-sm rounded-xl pl-10 pr-10 py-2.5 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.passwordLama && (
                <p className="text-rose-400 text-xs mt-1">{fieldErrors.passwordLama.join(", ")}</p>
              )}
            </div>

            {/* Password Baru */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password Baru
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
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
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-100 placeholder-slate-600 text-sm rounded-xl pl-10 pr-10 py-2.5 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.passwordBaru && (
                <p className="text-rose-400 text-xs mt-1">{fieldErrors.passwordBaru.join(", ")}</p>
              )}
            </div>

            {/* Konfirmasi Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Konfirmasi Password Baru
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <input
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
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-100 placeholder-slate-600 text-sm rounded-xl pl-10 pr-10 py-2.5 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.konfirmasi && (
                <p className="text-rose-400 text-xs mt-1">{fieldErrors.konfirmasi.join(", ")}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-xl py-3 px-4 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Password...</span>
                </>
              ) : (
                <>
                  <span>Simpan & Lanjutkan</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
