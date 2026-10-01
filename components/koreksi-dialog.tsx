"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { actions } from "@/lib/api/actions";
import { ERROR_MESSAGES, LIMIT } from "@/contract";
import { RotateCcw, AlertTriangle, Loader2 } from "lucide-react";

export default function KoreksiDialog({ transaksiId }: { transaksiId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientRequestIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000"
  );

  async function handleKoreksi(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (alasan.trim().length < LIMIT.ALASAN_MIN) {
      setErrorMessage(`Alasan minimal ${LIMIT.ALASAN_MIN} karakter.`);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await actions.koreksi({
        transaksiId,
        alasan: alasan.trim(),
        clientRequestId: clientRequestIdRef.current,
      });

      if (!res.ok) {
        setErrorMessage(res.message || ERROR_MESSAGES[res.code]);
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setErrorMessage(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 font-semibold text-xs flex items-center gap-2 transition-all"
      >
        <RotateCcw className="w-4 h-4" />
        <span>Koreksi / Dibalikkan (Reversal)</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-lg space-y-6 shadow-2xl relative">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-lg font-bold text-white">Konfirmasi Koreksi Transaksi</h2>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tindakan ini akan membalikkan efek finansial transaksi. Uang nasabah akan disesuaikan secara otomatis di ledger.
            </p>

            {errorMessage && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                <p className="font-semibold">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleKoreksi} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Alasan Koreksi (Wajib)
                </label>
                <textarea
                  rows={3}
                  required
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Jelaskan alasan pembatalan / koreksi transaksi..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 text-slate-100 placeholder-slate-600 text-xs rounded-xl p-3 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <span>Proses Koreksi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
