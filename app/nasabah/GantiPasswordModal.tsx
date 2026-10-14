"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { actions } from "@/lib/api/actions";
import { Key, Lock, AlertCircle, CheckCircle2, Loader2, X, Eye, EyeOff } from "lucide-react";

const emptySubscribe = () => () => {};

export function GantiPasswordModal() {
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
      onClick={() => {
        resetForm();
        setIsOpen(true);
      }}
      className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-semibold rounded-xl text-slate-200 border border-slate-700/60 hover:border-emerald-500/30 transition-all shadow-sm group"
    >
      <Key className="w-4 h-4 text-emerald-400 group-hover:rotate-12 transition-transform" />
      <span>Ganti Password</span>
    </button>
  );

  // ── Modal via Portal → lepas dari stacking context header ─────────────────
  const modalContent =
    mounted && isOpen
      ? createPortal(
          // Overlay: fixed full-screen, z-[100] melampaui sticky header (z-40)
          // overflow-y-auto agar aman di layar sangat kecil
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={(e) => {
              // Tutup jika klik backdrop (bukan card)
              if (e.target === e.currentTarget) handleClose();
            }}
          >
            {/* Card modal */}
            <div
              className="relative w-full max-w-md rounded-xl bg-[#0F172A] shadow-2xl border border-slate-800 my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header card */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Ganti Password</h2>
                    <p className="text-[11px] text-slate-400">Perbarui kata sandi akun Anda</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  aria-label="Tutup dialog"
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body card */}
              <div className="p-6">
                {success ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                    <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-white">Password Berhasil Diperbarui!</h3>
                    <p className="text-xs text-slate-400">
                      Kata sandi baru Anda sudah tersimpan dengan aman.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {errorMsg && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                        <span className="font-medium">{errorMsg}</span>
                      </div>
                    )}

                    {/* Password Lama */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Password Saat Ini
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showOld ? "text" : "password"}
                          disabled={loading}
                          value={form.passwordLama}
                          onChange={(e) => handleChange("passwordLama", e.target.value)}
                          placeholder="Masukkan password saat ini"
                          className={`w-full bg-slate-950 border ${
                            fieldErrors.passwordLama
                              ? "border-rose-500 focus:border-rose-400"
                              : "border-slate-800 focus:border-emerald-500"
                          } rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition-all`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowOld(!showOld)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                        >
                          {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {fieldErrors.passwordLama && (
                        <p className="text-[11px] text-rose-400 mt-1 font-medium">
                          {fieldErrors.passwordLama.join(", ")}
                        </p>
                      )}
                    </div>

                    {/* Password Baru */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Password Baru
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Key className="w-4 h-4" />
                        </div>
                        <input
                          type={showNew ? "text" : "password"}
                          disabled={loading}
                          value={form.passwordBaru}
                          onChange={(e) => handleChange("passwordBaru", e.target.value)}
                          placeholder="Minimal 8 karakter"
                          className={`w-full bg-slate-950 border ${
                            fieldErrors.passwordBaru
                              ? "border-rose-500 focus:border-rose-400"
                              : "border-slate-800 focus:border-emerald-500"
                          } rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition-all`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew(!showNew)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                        >
                          {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {fieldErrors.passwordBaru && (
                        <p className="text-[11px] text-rose-400 mt-1 font-medium">
                          {fieldErrors.passwordBaru.join(", ")}
                        </p>
                      )}
                    </div>

                    {/* Konfirmasi Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Konfirmasi Password Baru
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <input
                          type={showConfirm ? "text" : "password"}
                          disabled={loading}
                          value={form.konfirmasi}
                          onChange={(e) => handleChange("konfirmasi", e.target.value)}
                          placeholder="Ketik ulang password baru"
                          className={`w-full bg-slate-950 border ${
                            fieldErrors.konfirmasi
                              ? "border-rose-500 focus:border-rose-400"
                              : "border-slate-800 focus:border-emerald-500"
                          } rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition-all`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                        >
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {fieldErrors.konfirmasi && (
                        <p className="text-[11px] text-rose-400 mt-1 font-medium">
                          {fieldErrors.konfirmasi.join(", ")}
                        </p>
                      )}
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl py-3 flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Menyimpan Password...</span>
                          </>
                        ) : (
                          "Simpan Password Baru"
                        )}
                      </button>
                    </div>
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
