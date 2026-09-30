import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { queries } from "@/src/lib/api/queries";
import { formatRupiah, ERROR_MESSAGES, redirectUntukError } from "@/src/contract";
import { 
  UserCheck, 
  Wallet, 
  ArrowLeft, 
  ArrowDownLeft, 
  ArrowUpRight, 
  History, 
  ChevronRight, 
  RotateCcw,
  UserX
} from "lucide-react";

export default async function AdminNasabahDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  const nasabahRes = await queries.getNasabah({ customerId: id });
  if (!nasabahRes.ok) {
    const redir = redirectUntukError(nasabahRes.code);
    if (redir) redirect(redir);
    if (nasabahRes.code === "NASABAH_TIDAK_DITEMUKAN") notFound();
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
        {nasabahRes.message || ERROR_MESSAGES[nasabahRes.code]}
      </div>
    );
  }

  const nasabah = nasabahRes.data;
  const historiRes = await queries.getHistori({ customerId: id, limit: 20 });
  const historiItems = historiRes.ok ? historiRes.data.items : [];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Back */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Pencarian Nasabah</span>
        </Link>
      </div>

      {/* Nasabah Profile Card & Action Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl shrink-0 shadow-inner">
              {nasabah.nama.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-white">{nasabah.nama}</h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                    nasabah.aktif
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {nasabah.aktif ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                  {nasabah.aktif ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-1">
                ID Nasabah: <span className="text-emerald-400 font-semibold">{nasabah.username}</span>
              </p>
            </div>
          </div>

          {/* Balance Display */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 md:px-6 flex flex-col justify-center">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
              <Wallet className="w-4 h-4 text-emerald-400" />
              Saldo Rekening Nasabah
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
              {formatRupiah(nasabah.saldo)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href={`/admin/nasabah/${nasabah.id}/setor`}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-2xl py-3.5 px-6 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 group"
          >
            <ArrowDownLeft className="w-5 h-5 text-slate-950 group-hover:scale-110 transition-transform" />
            <span>Setor Sampah Baru</span>
          </Link>

          <Link
            href={`/admin/nasabah/${nasabah.id}/tarik`}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold text-sm rounded-2xl py-3.5 px-6 transition-all flex items-center justify-center gap-2 shadow-md hover:border-slate-600 group"
          >
            <ArrowUpRight className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>Penarikan Saldo Tunai</span>
          </Link>
        </div>
      </div>

      {/* Histori Mutasi Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <span>Riwayat Mutasi & Transaksi</span>
          </h2>
          <span className="text-xs text-slate-500">20 Transaksi Terbaru</span>
        </div>

        {historiItems.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            Belum ada riwayat transaksi untuk nasabah ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {historiItems.map((tx) => {
              const isSetor = tx.tipe === "setor";
              const isTarik = tx.tipe === "tarik";
              const isKoreksi = tx.tipe === "koreksi";

              return (
                <div
                  key={tx.id}
                  className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-800/30 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`p-2.5 rounded-xl border shrink-0 ${
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
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-200 capitalize">
                          {tx.tipe}
                        </span>
                        {tx.sudahDibalik && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-medium">
                            Dibalik
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {tx.catatan || `Diproses oleh: ${tx.dibuatOlehNama}`}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {new Date(tx.waktu).toLocaleString("id-ID", {
                          timeZone: "Asia/Jakarta",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}{" "}
                        WIB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span
                        className={`text-sm font-bold font-mono ${
                          tx.jumlah > 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {tx.jumlah > 0 ? "+" : ""}
                        {formatRupiah(tx.jumlah)}
                      </span>
                    </div>

                    <Link
                      href={`/admin/transaksi/${tx.id}`}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      title="Lihat Detail Transaksi"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
