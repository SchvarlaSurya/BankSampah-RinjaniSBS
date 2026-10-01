"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { actions } from "@/lib/api/actions";
import { type NasabahRingkas, formatRupiah, ERROR_MESSAGES } from "@/contract";
import {
  ArrowLeft,
  ArrowUpRight,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  DollarSign,
} from "lucide-react";

/** Data nasabah datang dari Server Component (page.tsx). */
export function TarikForm({
  customerId,
  nasabah,
}: {
  customerId: string;
  nasabah: NasabahRingkas;
}) {

  // Idempotency UUID created once per form open
  const clientRequestIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000"
  );

  const [jumlah, setJumlah] = useState<string>("");
  const [catatan, setCatatan] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [successData, setSuccessData] = useState<{
    saldoBaru: number;
    duplikat: boolean;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const valJumlah = parseInt(jumlah, 10);
    if (isNaN(valJumlah) || valJumlah <= 0) {
      setErrorMessage("Masukkan jumlah penarikan yang valid (minimal Rp1).");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setFieldErrors({});

    try {
      const res = await actions.tarik({
        customerId,
        jumlah: valJumlah,
        catatan: catatan || undefined,
        clientRequestId: clientRequestIdRef.current,
      });

      if (!res.ok) {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        setErrorMessage(res.message || ERROR_MESSAGES[res.code]);
      } else {
        setSuccessData({
          saldoBaru: res.data.saldoBaru,
          duplikat: res.data.duplikat,
        });
      }
    } catch {
      setErrorMessage(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  }

  if (successData) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Penarikan Saldo Berhasil!</h1>
            {successData.duplikat && (
              <p className="text-xs text-amber-400 mt-1">
                (Transaksi ini sudah pernah diproses sebelumnya / Idempotent)
              </p>
            )}
            <p className="text-sm text-slate-400 mt-2">
              Uang tunai diserahkan ke nasabah <span className="font-semibold text-slate-200">{nasabah?.nama}</span>.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
            <span className="text-xs text-slate-400 block mb-1">Saldo Terkini Nasabah</span>
            <span className="text-3xl font-extrabold text-emerald-400 font-mono">
              {formatRupiah(successData.saldoBaru)}
            </span>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setSuccessData(null);
                clientRequestIdRef.current = crypto.randomUUID();
                setJumlah("");
                setCatatan("");
              }}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl py-3"
            >
              Tarik Lagi
            </button>
            <Link
              href={`/admin/nasabah/${customerId}`}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl py-3 text-center"
            >
              Kembali ke Nasabah
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/admin/nasabah/${customerId}`}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Batal & Kembali ke Nasabah</span>
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Form Penarikan Saldo Tunai</h1>
            {nasabah && (
              <p className="text-xs text-slate-400 mt-1">
                Nasabah: <span className="text-emerald-400 font-semibold">{nasabah.nama}</span> ({nasabah.username})
              </p>
            )}
          </div>
        </div>

        {/* Balance Info */}
        {nasabah && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-400" />
              Saldo Rekening Saat Ini
            </span>
            <span className="text-xl font-extrabold text-emerald-400 font-mono">
              {formatRupiah(nasabah.saldo)}
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{errorMessage}</p>
              {nasabah && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Saldo yang tersedia: <span className="font-mono font-bold text-emerald-400">{formatRupiah(nasabah.saldo)}</span>
                </p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Jumlah Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Jumlah Penarikan (Rp)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="number"
                required
                min={1}
                placeholder="contoh: 50000"
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-100 placeholder-slate-600 text-sm font-mono rounded-xl pl-10 pr-4 py-3 outline-none"
              />
            </div>
            {fieldErrors.jumlah && (
              <p className="text-rose-400 text-xs mt-1.5">{fieldErrors.jumlah.join(", ")}</p>
            )}
          </div>

          {/* Catatan Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Catatan Penarikan (Opsional)
            </label>
            <textarea
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Keterangan penarikan tunai..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-100 placeholder-slate-600 text-xs rounded-xl p-3 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl py-3.5 px-4 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 mt-4"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Penarikan...</span>
              </>
            ) : (
              <span>Konfirmasi Penarikan Tunai</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
