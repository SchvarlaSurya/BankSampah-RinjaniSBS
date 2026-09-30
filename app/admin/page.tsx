"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { queries } from "@/src/lib/api/queries";
import { NasabahRingkas, formatRupiah, ERROR_MESSAGES } from "@/src/contract";
import { Search, UserCheck, Wallet, ArrowRight, Loader2, UserX, AlertCircle } from "lucide-react";

export default function AdminSearchPage() {
  const [query, setQuery] = useState("");
  const [nasabahList, setNasabahList] = useState<NasabahRingkas[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSearch = useCallback(async (q: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await queries.cariNasabah({ query: q || "a" }); // Default initial search
      if (res.ok) {
        setNasabahList(res.data);
      } else {
        setErrorMessage(ERROR_MESSAGES[res.code]);
      }
    } catch {
      setErrorMessage(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    handleSearch("");
  }, [handleSearch]);

  return (
    <div className="space-y-8">
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Search className="w-3.5 h-3.5" />
            <span>Pencarian Nasabah</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Kelola & Transaksi Nasabah
          </h1>
          <p className="text-sm text-slate-400">
            Cari nasabah berdasarkan ID Nasabah (Username) atau Nama untuk memproses Setor Sampah atau Penarikan Saldo Tunai.
          </p>

          {/* Search Box Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(query);
            }}
            className="flex flex-col sm:flex-row gap-3 pt-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  handleSearch(e.target.value);
                }}
                placeholder="Ketik nama atau ID nasabah (contoh: nasabah01)..."
                className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 placeholder-slate-500 text-sm rounded-xl pl-10 pr-4 py-3 outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm rounded-xl px-5 py-3 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Cari</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Nasabah List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <span>Hasil Pencarian</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs font-mono">
              {nasabahList.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className="text-sm font-medium">Mencari data nasabah...</span>
          </div>
        ) : nasabahList.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-400 space-y-3">
            <UserX className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="font-semibold text-sm">Nasabah tidak ditemukan</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Coba gunakan kata kunci pencarian lain atau periksa kembali ID Nasabah.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nasabahList.map((nasabah) => (
              <div
                key={nasabah.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition-all flex flex-col justify-between group shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-base text-slate-100 group-hover:text-emerald-400 transition-colors">
                        {nasabah.nama}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        ID: <span className="text-slate-300 font-semibold">{nasabah.username}</span>
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 ${
                        nasabah.aktif
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      <UserCheck className="w-3 h-3" />
                      {nasabah.aktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-slate-500" />
                      Saldo Terkini
                    </span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      {formatRupiah(nasabah.saldo)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-3">
                  <Link
                    href={`/admin/nasabah/${nasabah.id}`}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl py-2.5 px-4 transition-all flex items-center justify-center gap-2 group-hover:bg-emerald-500 group-hover:text-slate-950 font-semibold"
                  >
                    <span>Detail & Transaksi</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
