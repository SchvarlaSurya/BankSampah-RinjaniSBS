"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type PenggunaRingkas,
  type TransaksiDetail,
  type TipeTransaksi,
  formatRupiah,
  TIPE_TRANSAKSI,
} from "@/contract";
import {
  FileCheck,
  ImageIcon,
  Loader2,
  AlertCircle,
  Filter,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  ChevronLeft,
  ExternalLink,
  CalendarDays,
  SlidersHorizontal,
} from "lucide-react";

export interface FilterAudit {
  adminId: string;
  tipe: TipeTransaksi | "";
  dari: string;
  sampai: string;
}

/**
 * Data audit datang dari Server Component (page.tsx). Filter & halaman disimpan di URL:
 * `jejak` = cursor halaman-halaman sebelumnya ("-" = halaman pertama), untuk tombol Sebelumnya.
 */
export function AuditView({
  stafList,
  auditItems,
  nextCursor,
  filter,
  cursor,
  jejak,
  errorMessage,
}: {
  stafList: PenggunaRingkas[];
  auditItems: TransaksiDetail[];
  nextCursor: string | null;
  filter: FilterAudit;
  cursor: string | undefined;
  jejak: string[];
  errorMessage: string | null;
}) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();

  // Isian filter (baru berlaku setelah "Terapkan Filter").
  const [filterAdminId, setFilterAdminId] = useState(filter.adminId);
  const [filterTipe, setFilterTipe] = useState<TipeTransaksi | "">(filter.tipe);
  const [filterDari, setFilterDari] = useState(filter.dari);
  const [filterSampai, setFilterSampai] = useState(filter.sampai);
  const cursorStack = jejak;

  function buka(f: FilterAudit, c: string | undefined, j: string[]) {
    const q = new URLSearchParams();
    if (f.adminId) q.set("admin", f.adminId);
    if (f.tipe) q.set("tipe", f.tipe);
    if (f.dari) q.set("dari", f.dari);
    if (f.sampai) q.set("sampai", f.sampai);
    if (c) q.set("cursor", c);
    if (j.length > 0) q.set("jejak", j.join(","));
    const qs = q.toString();
    startTransition(() => router.push(qs ? `/admin/audit?${qs}` : "/admin/audit"));
  }

  function handleNextPage() {
    if (!nextCursor) return;
    buka(filter, nextCursor, [...jejak, cursor ?? "-"]);
  }

  function handlePrevPage() {
    const stack = [...jejak];
    const sebelumnya = stack.pop();
    buka(filter, sebelumnya && sebelumnya !== "-" ? sebelumnya : undefined, stack);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-3 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <FileCheck className="w-3.5 h-3.5" />
          <span>Super Admin Audit Mode</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Audit Transaksi &amp; Foto Timbangan</h1>
        <p className="text-xs text-slate-400 max-w-xl">
          Log pemeriksaan transaksi lengkap dengan perbandingan foto timbangan dan rincian barang.
        </p>
      </div>

      {/* Filter Panel */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
          <Filter className="w-4 h-4 text-emerald-400" />
          <span>Filter Audit</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filter Petugas */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Petugas / Admin
            </label>
            <select
              value={filterAdminId}
              onChange={(e) => setFilterAdminId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="">Semua Petugas</option>
              {stafList.map((staf) => (
                <option key={staf.id} value={staf.id}>
                  {staf.nama} ({staf.role})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Tipe */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Tipe Transaksi
            </label>
            <select
              value={filterTipe}
              onChange={(e) => setFilterTipe(e.target.value as TipeTransaksi | "")}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="">Semua Tipe</option>
              {TIPE_TRANSAKSI.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Dari */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              Dari Tanggal
            </label>
            <input
              type="date"
              value={filterDari}
              onChange={(e) => setFilterDari(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Filter Sampai */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={filterSampai}
              onChange={(e) => setFilterSampai(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() =>
              buka({ adminId: filterAdminId, tipe: filterTipe, dari: filterDari, sampai: filterSampai }, undefined, [])
            }
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl px-4 py-2.5 transition-colors flex items-center gap-2 shadow-md shadow-emerald-500/20"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Filter className="w-3.5 h-3.5" />}
            Terapkan Filter
          </button>
          <button
            onClick={() => {
              setFilterAdminId("");
              setFilterTipe("");
              setFilterDari("");
              setFilterSampai("");
              buka({ adminId: "", tipe: "", dari: "", sampai: "" }, undefined, []);
            }}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Audit Items */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
          <span className="text-sm font-medium">Memuat data audit...</span>
        </div>
      ) : auditItems.length === 0 ? (
        <div className="py-12 bg-slate-900/60 border border-slate-800 rounded-3xl text-center text-slate-500 text-sm space-y-2">
          <FileCheck className="w-10 h-10 text-slate-700 mx-auto" />
          <p className="font-semibold">Tidak ada transaksi yang cocok</p>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            Coba ubah filter untuk melihat data yang berbeda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {auditItems.map((tx) => {
            const isSetor = tx.tipe === "setor";
            const isTarik = tx.tipe === "tarik";
            const isKoreksi = tx.tipe === "koreksi";

            return (
              <div
                key={tx.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-6 space-y-4 shadow-lg flex flex-col justify-between transition-colors"
              >
                <div className="space-y-3">
                  {/* Header Row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-2 rounded-xl border ${
                          isSetor
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : isTarik
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {isSetor && <ArrowDownLeft className="w-4 h-4" />}
                        {isTarik && <ArrowUpRight className="w-4 h-4" />}
                        {isKoreksi && <RotateCcw className="w-4 h-4" />}
                        {tx.tipe === "penyesuaian" && <SlidersHorizontal className="w-4 h-4" />}
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold capitalize">
                        {tx.tipe}
                      </span>
                      {tx.sudahDibalik && (
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-medium">
                          Dibalik
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-base font-extrabold font-mono ${
                        tx.jumlah > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {tx.jumlah > 0 ? "+" : ""}
                      {formatRupiah(tx.jumlah)}
                    </span>
                  </div>

                  {/* Detail Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Nasabah</span>
                      <span className="font-semibold text-slate-200">{tx.customerNama}</span>
                      <span className="text-slate-500 font-mono block">@{tx.customerUsername}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Petugas</span>
                      <span className="font-semibold text-slate-200">{tx.dibuatOlehNama}</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 font-mono">
                    {new Date(tx.waktu).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                      dateStyle: "long",
                      timeStyle: "short",
                    })}{" "}
                    WIB
                  </div>

                  {/* Items (for setor) */}
                  {tx.items.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Rincian Sampah
                      </p>
                      {tx.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-300">{item.namaSampah}</span>
                          <span className="text-slate-400 font-mono">
                            {item.berat} kg &times; {formatRupiah(item.hargaSnapshot)}/kg
                          </span>
                          <span className="text-emerald-400 font-mono font-semibold">
                            {formatRupiah(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {tx.catatan && (
                    <p className="text-xs text-slate-400 italic border-l-2 border-slate-700 pl-3">
                      {tx.catatan}
                    </p>
                  )}
                </div>

                <div className="flex items-end justify-between gap-3">
                  {/* Foto Timbangan */}
                  {tx.fotoUrl ? (
                    <div className="flex-1 space-y-2">
                      <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                        Foto Timbangan
                      </span>
                      <div className="w-full h-44 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                        <img
                          src={tx.fotoUrl}
                          alt={`Foto timbangan transaksi ${tx.id}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 h-12 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-center">
                      <span className="text-[10px] text-slate-600">Tidak ada foto</span>
                    </div>
                  )}

                  {/* Link ke detail */}
                  <Link
                    href={`/admin/transaksi/${tx.id}`}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0"
                    title="Lihat Detail Transaksi"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Detail
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {(cursorStack.length > 0 || nextCursor) && !loading && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handlePrevPage}
            disabled={cursorStack.length === 0}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-xl transition-colors ${
              cursorStack.length > 0
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                : "bg-slate-800/40 text-slate-600 cursor-not-allowed"
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Sebelumnya</span>
          </button>

          <span className="text-xs text-slate-500">
            Halaman {cursorStack.length + 1}
          </span>

          <button
            onClick={handleNextPage}
            disabled={!nextCursor}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-xl transition-colors ${
              nextCursor
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                : "bg-slate-800/40 text-slate-600 cursor-not-allowed"
            }`}
          >
            <span>Berikutnya</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
