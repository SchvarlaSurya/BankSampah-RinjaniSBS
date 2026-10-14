"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { actions } from "@/lib/api/actions";
import { ERROR_MESSAGES, LIMIT, formatRupiah, type NasabahRingkas } from "@/contract";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Minus, Plus, SlidersHorizontal, Wallet } from "lucide-react";

type Arah = "tambah" | "kurangi";

/**
 * Penyesuaian saldo (admin & super_admin): dicatat sebagai transaksi baru bertipe "penyesuaian"
 * dengan alasan wajib, bukan mengubah angka saldo. Data nasabah dari Server Component (page.tsx).
 */
export function PenyesuaianForm({ customerId, nasabah }: { customerId: string; nasabah: NasabahRingkas }) {
  // UUID idempotensi dibuat sekali per form terbuka, dipakai ulang saat "coba lagi".
  const clientRequestIdRef = useRef<string>(crypto.randomUUID());

  const [arah, setArah] = useState<Arah>("tambah");
  const [jumlah, setJumlah] = useState("");
  const [alasan, setAlasan] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [hasil, setHasil] = useState<{ saldoBaru: number; duplikat: boolean; jumlah: number } | null>(null);

  const nilai = Number.parseInt(jumlah, 10);
  const nilaiValid = Number.isInteger(nilai) && nilai > 0;
  const bertanda = nilaiValid ? (arah === "tambah" ? nilai : -nilai) : 0;
  const perkiraanSaldo = nasabah.saldo + bertanda;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErrorMessage(null);
    setFieldErrors({});

    if (!nilaiValid) {
      setErrorMessage("Masukkan jumlah penyesuaian yang valid (minimal Rp1).");
      return;
    }
    if (perkiraanSaldo < 0) {
      setErrorMessage(ERROR_MESSAGES.SALDO_TIDAK_CUKUP);
      return;
    }

    setLoading(true);
    try {
      const res = await actions.sesuaikanSaldo({
        customerId,
        jumlah: bertanda,
        alasan,
        clientRequestId: clientRequestIdRef.current,
      });
      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        const pesanField = res.fieldErrors ? Object.values(res.fieldErrors).flat()[0] : undefined;
        setErrorMessage(pesanField || res.message);
      } else {
        setHasil({ saldoBaru: res.data.saldoBaru, duplikat: res.data.duplikat, jumlah: res.data.transaksi.jumlah });
      }
    } catch {
      setErrorMessage(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  }

  if (hasil) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <div className="bg-slate-900 border border-sky-500/30 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Penyesuaian Saldo Tercatat</h1>
            {hasil.duplikat && (
              <p className="text-xs text-amber-400 mt-1">(Permintaan ini sudah pernah diproses sebelumnya)</p>
            )}
            <p className="text-sm text-slate-400 mt-2">
              {hasil.jumlah >= 0 ? "Penambahan" : "Pengurangan"}{" "}
              <span className="font-mono font-semibold text-slate-200">{formatRupiah(Math.abs(hasil.jumlah))}</span> untuk{" "}
              <span className="font-semibold text-slate-200">{nasabah.nama}</span>.
            </p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
            <span className="text-xs text-slate-400 block mb-1">Saldo Terkini Nasabah</span>
            <span className="text-3xl font-extrabold text-emerald-400 font-mono">{formatRupiah(hasil.saldoBaru)}</span>
          </div>
          <Link
            href={`/admin/nasabah/${customerId}`}
            className="block bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl py-3 text-center"
          >
            Kembali ke Nasabah
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Link
        href={`/admin/nasabah/${customerId}`}
        className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Batal & Kembali ke Nasabah</span>
      </Link>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
          <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <SlidersHorizontal className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Penyesuaian Saldo</h1>
            <p className="text-xs text-slate-400 mt-1">
              Nasabah: <span className="text-emerald-400 font-semibold">{nasabah.nama}</span> ({nasabah.username})
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Saldo tidak diubah langsung: penyesuaian dicatat sebagai transaksi baru (nama petugas, waktu, dan alasan)
          dan tampil di histori nasabah serta audit. Kesalahan penyesuaian dibetulkan super admin lewat koreksi.
        </p>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-emerald-400" />
            Saldo Saat Ini
          </span>
          <span className="text-xl font-extrabold text-emerald-400 font-mono">{formatRupiah(nasabah.saldo)}</span>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="font-semibold">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Jenis penyesuaian">
            {(["tambah", "kurangi"] as const).map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={arah === a}
                onClick={() => setArah(a)}
                className={`rounded-xl py-3 text-sm font-semibold border flex items-center justify-center gap-2 transition-colors ${
                  arah === a
                    ? a === "tambah"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-500/15 border-rose-500/40 text-rose-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {a === "tambah" ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                {a === "tambah" ? "Tambah Saldo" : "Kurangi Saldo"}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="jumlah" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Jumlah (Rp)
            </label>
            <input
              id="jumlah"
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={LIMIT.MAKS_TARIK_RUPIAH}
              placeholder="contoh: 25000"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-100 placeholder-slate-600 text-sm font-mono rounded-xl px-4 py-3 outline-none"
            />
            {fieldErrors.jumlah && <p className="text-rose-400 text-xs mt-1.5">{fieldErrors.jumlah.join(", ")}</p>}
            {nilaiValid && (
              <p className={`text-xs mt-1.5 ${perkiraanSaldo < 0 ? "text-rose-400" : "text-slate-400"}`}>
                Perkiraan saldo setelahnya: <span className="font-mono font-semibold">{formatRupiah(perkiraanSaldo)}</span>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="alasan" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Alasan (wajib)
            </label>
            <textarea
              id="alasan"
              rows={3}
              required
              minLength={LIMIT.ALASAN_MIN}
              maxLength={LIMIT.ALASAN_MAKS}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="contoh: Saldo awal dari buku tabungan manual per 1 Oktober 2026"
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-slate-100 placeholder-slate-600 text-xs rounded-xl p-3 outline-none"
            />
            {fieldErrors.alasan && <p className="text-rose-400 text-xs mt-1.5">{fieldErrors.alasan.join(", ")}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm rounded-xl py-3.5 px-4 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>Simpan Penyesuaian</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
