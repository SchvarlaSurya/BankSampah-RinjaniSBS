import Link from "next/link";
import { redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import {
  type RiwayatHargaItem,
  type JenisSampah,
  formatRupiah,
  redirectUntukError,
} from "@/contract";
import {
  History,
  Trash2,
  Filter,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Calendar,
  User,
  ArrowLeft,
} from "lucide-react";
import { FilterSampah } from "./filter-sampah";

export default async function AuditHargaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).sampah;
  const selectedSampahId = typeof raw === "string" ? raw : "";

  const [logRes, jenisRes] = await Promise.all([
    queries.listRiwayatHarga({ sampahId: selectedSampahId || undefined }),
    queries.listJenisSampah({ termasukNonaktif: true }),
  ]);
  let logs: RiwayatHargaItem[] = [];
  let authError: string | null = null;
  let errorMessage: string | null = null;
  if (logRes.ok) {
    logs = logRes.data;
  } else {
    const redir = redirectUntukError(logRes.code);
    if (redir) redirect(redir);
    if (logRes.code === "TIDAK_DIIZINKAN") authError = "Halaman audit ini hanya dapat diakses oleh Super Admin.";
    else errorMessage = logRes.message;
  }
  const wasteTypes: JenisSampah[] = jenisRes.ok ? jenisRes.data : [];
  const loading = false;

  if (authError) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{authError}</span>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Super Admin Audit Log</span>
          </div>

          <Link
            href="/admin/jenis-sampah"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700/60"
          >
            <Trash2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Kelola Katalog Sampah</span>
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white">Audit Log Perubahan Harga Sampah</h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Rekaman kronologis setiap perubahan harga tarif sampah yang dilakukan oleh Admin maupun Super Admin untuk transparansi dan akuntabilitas.
        </p>
      </div>

      {/* Filter Panel */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-3 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Filter Berdasarkan Jenis Sampah</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {logs.length} catatan riwayat
          </span>
        </div>

        <FilterSampah wasteTypes={wasteTypes} terpilih={selectedSampahId} />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Table / List View */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs flex justify-center items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span>Memuat data riwayat perubahan harga...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <History className="w-10 h-10 text-slate-700 mx-auto" />
            <p className="font-semibold text-sm">Belum Ada Riwayat Perubahan Harga</p>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Setiap kali harga sampah diubah pada menu Katalog Sampah, catatan perubahannya akan otomatis muncul di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Tanggal &amp; Jam</th>
                  <th className="px-5 py-3.5">Jenis Sampah</th>
                  <th className="px-5 py-3.5 text-right">Harga Lama</th>
                  <th className="px-5 py-3.5 text-center">Perubahan</th>
                  <th className="px-5 py-3.5 text-right">Harga Baru</th>
                  <th className="px-5 py-3.5">Diubah Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {logs.map((log) => {
                  const selisih = log.hargaBaru - log.hargaLama;
                  const isNaik = selisih > 0;
                  const isAwal = log.hargaLama === 0;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Tanggal & Jam */}
                      <td className="px-5 py-4 whitespace-nowrap text-slate-300 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {new Date(log.createdAt).toLocaleString("id-ID", {
                              timeZone: "Asia/Jakarta",
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}{" "}
                            WIB
                          </span>
                        </div>
                      </td>

                      {/* Jenis Sampah */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-bold text-slate-100 text-sm">
                          {log.sampahNama}
                        </span>
                      </td>

                      {/* Harga Lama */}
                      <td className="px-5 py-4 whitespace-nowrap text-right font-mono text-slate-400">
                        {isAwal ? (
                          <span className="text-slate-600 italic">Harga Awal</span>
                        ) : (
                          <span>{formatRupiah(log.hargaLama)}</span>
                        )}
                      </td>

                      {/* Indikator Perubahan */}
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        {isAwal ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            Baru Dibuat
                          </span>
                        ) : isNaik ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                            <TrendingUp className="w-3 h-3" />
                            +{formatRupiah(selisih)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                            <TrendingDown className="w-3 h-3" />
                            {formatRupiah(selisih)}
                          </span>
                        )}
                      </td>

                      {/* Harga Baru */}
                      <td className="px-5 py-4 whitespace-nowrap text-right font-mono font-bold text-emerald-400 text-sm">
                        {formatRupiah(log.hargaBaru)}
                      </td>

                      {/* Diubah Oleh */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                            <User className="w-3 h-3" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200">
                              {log.diubahOlehNama}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500">
                              @{log.diubahOlehUsername}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
