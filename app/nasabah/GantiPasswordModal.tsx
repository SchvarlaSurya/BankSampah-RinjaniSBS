"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { actions } from "@/lib/api/actions";
import { Key, CheckCircle2, Loader2, X, Eye, EyeOff } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";

const emptySubscribe = () => () => {};

/** varian hanya mengubah tampilan tombol pemicu (di sidebar gelap atau di halaman terang). */
export function GantiPasswordModal({ varian = "default" }: { varian?: "default" | "sidebar" | "ikon" }) {
  const [isOpen, setIsOpen] = useState(false);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    passwordLama: "",
    passwordBaru: "",
    konfirmasi: "",
  });

  // Lock body scroll saat modal terbuka
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  function resetForm() {
    setForm({ passwordLama: "", passwordBaru: "", konfirmasi: "" });
    setErrorMsg(null);
    setFieldErrors({});
    setShowOld(false);
    setShowNew(false);
    setShowConfirm(false);
    setSuccess(false);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
    resetForm();
  }

  function handleChange(field: "passwordLama" | "passwordBaru" | "konfirmasi", value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errorMsg || fieldErrors[field]) {
      setErrorMsg(null);
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setErrorMsg(null);
    setFieldErrors({});

    if (!form.passwordLama) {
      setErrorMsg("Password saat ini wajib diisi.");
      setFieldErrors({ passwordLama: ["Password saat ini wajib diisi."] });
      return;
    }
    if (form.passwordBaru.length < 8) {
      setErrorMsg("Password baru minimal 8 karakter.");
      setFieldErrors({ passwordBaru: ["Minimal 8 karakter."] });
      return;
    }
    if (form.passwordBaru !== form.konfirmasi) {
      setErrorMsg("Konfirmasi password baru tidak cocok.");
      setFieldErrors({ konfirmasi: ["Konfirmasi password tidak cocok."] });
      return;
    }
    if (form.passwordBaru === form.passwordLama) {
      setErrorMsg("Password baru tidak boleh sama dengan password saat ini.");
      setFieldErrors({ passwordBaru: ["Tidak boleh sama dengan password lama."] });
      return;
    }

    setLoading(true);

    try {
      const res = await actions.gantiPassword(form);
      if (res.ok) {
        setSuccess(true);
        setForm({ passwordLama: "", passwordBaru: "", konfirmasi: "" });
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
        }, 2200);
      } else {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
          const firstMsg = Object.values(res.fieldErrors).flat()[0];
          setErrorMsg(firstMsg || res.message);
        } else {
          setErrorMsg(res.message);
        }
      }
    } catch {
      setErrorMsg("Terjadi kesalahan di server. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  // ── Trigger button ────────────────────────────────────────────────────────
  const triggerButton = (
    <button
      type="button"
      onClick={() => {
        resetForm();
        setIsOpen(true);
      }}
      className={
        varian === "sidebar"
          ? "flex h-10 w-full items-center gap-3 rounded-control px-3 text-sm font-medium text-sidebar-text [&_svg]:size-4 transition-colors duration-150 hover:bg-sidebar-active hover:text-sidebar-text-active"
          : buttonClass("secondary", varian === "ikon" ? "icon" : "md")
      }
      aria-label={varian === "ikon" ? "Ganti password" : undefined}
    >
      <Key aria-hidden="true" />
      {varian !== "ikon" && <span>Ganti Password</span>}
    </button>
  );

  // Satu baris field password + tombol lihat/sembunyikan; nama field & handler tidak berubah.
  const kolom = (
    id: "passwordLama" | "passwordBaru" | "konfirmasi",
    label: string,
    tampil: boolean,
    setTampil: (v: boolean) => void,
    placeholder: string,
    autoComplete: string,
  ) => (
    <Field label={label} htmlFor={`gp-${id}`} error={fieldErrors[id]?.join(", ")}>
      <div className="relative">
        <input
          id={`gp-${id}`}
          type={tampil ? "text" : "password"}
          disabled={loading}
          value={form[id]}
          onChange={(e) => handleChange(id, e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={fieldErrors[id] ? true : undefined}
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setTampil(!tampil)}
          aria-label={tampil ? "Sembunyikan password" : "Tampilkan password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-control text-ink-muted hover:text-ink"
        >
          {tampil ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Field>
  );

  // ── Modal via Portal → lepas dari stacking context header ─────────────────
  const modalContent =
    mounted && isOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-ink/40 p-4 sm:items-center"
            onClick={(e) => {
              // Tutup jika klik backdrop (bukan card)
              if (e.target === e.currentTarget) handleClose();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="gp-judul"
              className="relative my-auto w-full max-w-md rounded-card border border-line bg-surface shadow-overlay animate-in fade-in-0 zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
                <div>
                  <h2 id="gp-judul" className="text-base font-semibold text-ink">
                    Ganti Password
                  </h2>
                  <p className="text-sm text-ink-muted">Perbarui kata sandi akun Anda.</p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  aria-label="Tutup dialog"
                  className={buttonClass("ghost", "icon", "-mr-2")}
                >
                  <X />
                </button>
              </div>

              <div className="p-6">
                {success ? (
                  <div className="flex flex-col items-center py-6 text-center">
                    <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-success-bg text-success-fg">
                      <CheckCircle2 className="size-6" />
                    </div>
                    <h3 className="font-semibold text-ink">Password berhasil diperbarui</h3>
                    <p className="mt-1 text-sm text-ink-muted">Kata sandi baru Anda sudah tersimpan.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {errorMsg && <Alert tone="danger">{errorMsg}</Alert>}
                    {kolom("passwordLama", "Password saat ini", showOld, setShowOld, "Masukkan password saat ini", "current-password")}
                    {kolom("passwordBaru", "Password baru", showNew, setShowNew, "Minimal 8 karakter", "new-password")}
                    {kolom("konfirmasi", "Konfirmasi password baru", showConfirm, setShowConfirm, "Ketik ulang password baru", "new-password")}
                    <Button type="submit" disabled={loading} className="w-full">
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin" />
                          <span>Menyimpan…</span>
                        </>
                      ) : (
                        "Simpan password baru"
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {triggerButton}
      {modalContent}
    </>
  );
}
