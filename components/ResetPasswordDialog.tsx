"use client";

import { useState } from "react";
import { actions } from "@/lib/api/actions";
import { ERROR_MESSAGES } from "@/contract";
import { KeyRound, CheckCircle2, Copy, Check, Loader2, X, ShieldAlert } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Alert, ModalShell } from "@/components/ui/feedback";

interface ResetPasswordDialogProps {
  userId: string;
  username: string;
  nama: string;
  role?: "admin" | "nasabah" | "super_admin";
  /** "kecil" = tombol ringkas (halaman detail nasabah). Props harus serializable: komponen ini dipakai dari Server Component. */
  varian?: "default" | "kecil";
  onSuccess?: () => void;
}

export default function ResetPasswordDialog({
  userId,
  username,
  nama,
  role,
  varian = "default",
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
      {varian === "kecil" ? (
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setConfirmOpen(true);
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-control sm:h-8 border border-button-secondary-border bg-button-secondary-bg px-2.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-button-secondary-hover"
          title={`Reset password untuk ${nama}`}
        >
          <KeyRound className="size-3.5" aria-hidden="true" />
          <span>Reset Password</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setConfirmOpen(true);
          }}
          className={buttonClass("secondary")}
          title={`Reset password untuk ${nama}`}
        >
          <KeyRound aria-hidden="true" />
          <span>Reset Password</span>
        </button>
      )}

      {/* 1. Modal Konfirmasi */}
      {confirmOpen && (
        <ModalShell labelledBy={`reset-judul-${userId}`} className="space-y-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-bg text-warning-fg">
              <ShieldAlert className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <h2 id={`reset-judul-${userId}`} className="text-base font-semibold text-ink">
                Konfirmasi reset password
              </h2>
              <p className="text-sm text-ink-muted">Tindakan ini memerlukan perhatian khusus.</p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
              aria-label="Tutup dialog"
              className={buttonClass("ghost", "icon", "-mt-2 -mr-2")}
            >
              <X />
            </button>
          </div>

          <div className="space-y-2 rounded-control bg-surface-muted p-4 text-sm text-ink ring-1 ring-line ring-inset">
            <p>
              Reset password untuk akun <strong className="font-semibold">{nama}</strong> (
              <span className="text-ink-muted">@{username}</span>)?
            </p>
            <p className="text-ink-muted">
              Password lama tidak bisa dipakai lagi dan semua sesi aktif akun ini akan langsung dikeluarkan.
            </p>
          </div>

          {errorMessage && <Alert tone="danger">{errorMessage}</Alert>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={loading}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleConfirmReset} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  <span>Mereset…</span>
                </>
              ) : (
                <>
                  <KeyRound />
                  <span>Ya, reset password</span>
                </>
              )}
            </Button>
          </div>
        </ModalShell>
      )}

      {/* 2. Modal Hasil Password Sementara */}
      {successOpen && tempPassword && (
        <ModalShell labelledBy={`reset-hasil-${userId}`} className="space-y-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <h2 id={`reset-hasil-${userId}`} className="text-base font-semibold text-ink">
                Password berhasil direset
              </h2>
              <p className="text-sm text-ink-muted">
                Akun: <strong className="font-semibold text-ink">{nama}</strong> (@{username})
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink">Password sementara baru</p>
            <div className="flex items-center justify-between gap-3 rounded-control bg-surface-muted p-3 ring-1 ring-line ring-inset">
              <span className="text-lg font-semibold tracking-wider break-all text-ink tabular-nums slashed-zero select-all">
                {tempPassword}
              </span>
              <Button variant="secondary" onClick={handleCopy} className="shrink-0">
                {copied ? (
                  <>
                    <Check />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy />
                    <span>Salin</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <Alert tone="warning" title="Penting">
            Password ini <strong>hanya ditampilkan sekali</strong>. Sampaikan ke pengguna lewat jalur yang aman, dan pengguna wajib menggantinya saat login pertama.
          </Alert>

          <Button variant="primary" onClick={handleCloseSuccess} className="w-full">
            Tutup & selesai
          </Button>
        </ModalShell>
      )}
    </>
  );
}
