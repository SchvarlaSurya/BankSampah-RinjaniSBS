"use client";

import { useState } from "react";
import { actions } from "@/lib/api/actions";
import { ERROR_MESSAGES } from "@/contract";
import {
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  X,
  ShieldAlert,
} from "lucide-react";

interface ResetPasswordDialogProps {
  userId: string;
  username: string;
  nama: string;
  role?: "admin" | "nasabah" | "super_admin";
  customTrigger?: (onClick: () => void) => React.ReactNode;
  onSuccess?: () => void;
}

export default function ResetPasswordDialog({
  userId,
  username,
  nama,
  role,
  customTrigger,
  onSuccess,
}: ResetPasswordDialogProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Jangan render apa pun jika target adalah super_admin
  if (role === "super_admin") {
    return null;
  }

  async function handleConfirmReset() {
    if (loading) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await actions.resetPasswordPengguna({ userId });
      if (!res.ok) {
        setErrorMessage(res.message || ERROR_MESSAGES[res.code]);
      } else {
        setTempPassword(res.data.passwordSementara);
        setConfirmOpen(false);
        setSuccessOpen(true);
        if (onSuccess) onSuccess();
      }
    } catch {
      setErrorMessage(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCloseSuccess() {
    // Password dibersihkan dari state UI saat modal ditutup
    setTempPassword(null);
    setSuccessOpen(false);
    setCopied(false);
    setErrorMessage(null);
  }

  return (
    <>
      {customTrigger ? (
        customTrigger(() => {
          setErrorMessage(null);
          setConfirmOpen(true);
        })
      ) : (
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setConfirmOpen(true);
          }}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs flex items-center gap-1.5 font-semibold transition-colors border border-slate-700 hover:border-amber-500/30"
          title={`Reset password untuk ${nama}`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Reset Password</span>
        </button>
      )}

      {/* 1. Modal Konfirmasi */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 w-full max-w-md space-y-5 shadow-2xl relative animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-3.5 text-amber-400">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 shrink-0">
                <ShieldAlert className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Konfirmasi Reset Password</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tindakan ini memerlukan perhatian khusus.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 leading-relaxed space-y-2">
              <p>
                Reset password untuk akun <strong className="text-white">{nama}</strong> (
                <span className="font-mono text-emerald-400">@{username}</span>)?
              </p>
              <p className="text-amber-300/90 text-[11px]">
                Password lama tidak bisa dipakai lagi dan semua sesi aktif akun ini akan langsung dikeluarkan.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mereset...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Ya, Reset Password</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Hasil Password Sementara */}
      {successOpen && tempPassword && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-7 w-full max-w-md space-y-5 shadow-2xl relative animate-in zoom-in-95">
            <div className="flex items-start gap-3.5 text-emerald-400">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Password Berhasil Direset</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Akun: <strong className="text-slate-200">{nama}</strong> (<span className="font-mono text-emerald-400">@{username}</span>)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Password Sementara Baru:
              </label>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                <span className="font-mono font-bold text-sm sm:text-base text-amber-400 tracking-wider select-all break-all">
                  {tempPassword}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 border border-slate-700"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                Penting:
              </p>
              <p className="text-[11px] text-amber-200/90">
                Password ini <strong>hanya ditampilkan sekali</strong>. Sampaikan ke pengguna lewat jalur yang aman, dan pengguna wajib menggantinya saat login pertama.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleCloseSuccess}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl py-3 transition-colors"
              >
                Tutup & Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
