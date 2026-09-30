import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { queries } from "@/src/lib/api/queries";
import { formatRupiah, redirectUntukError } from "@/src/contract";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  User,
  Calendar,
  Image as ImageIcon,
  AlertTriangle,
  Scale,
} from "lucide-react";
import KoreksiDialog from "@/components/koreksi-dialog";

export default async function TransaksiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [sesi, txRes] = await Promise.all([
    queries.getSesi(),
    queries.getTransaksi({ id }),
  ]);

  if (!sesi) redirect("/login");

  if (!txRes.ok) {
    const redir = redirectUntukError(txRes.code);
    if (redir) redirect(redir);
    if (txRes.code === "TRANSAKSI_TIDAK_DITEMUKAN") notFound();
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
        {txRes.message}
      </div>
    );
  }

  const tx = txRes.data;
  const isSuperAdmin = sesi.role === "super_admin";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/admin/nasabah/${tx.customerId}`}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Nasabah</span>
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-2xl">
        {/* Header Badge & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div
              className={`p-3.5 rounded-2xl border ${
                tx.tipe === "setor"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : tx.tipe === "tarik"
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              {tx.tipe === "setor" && <ArrowDownLeft className="w-6 h-6" />}
              {tx.tipe === "tarik" && <ArrowUpRight className="w-6 h-6" />}
              {tx.tipe === "koreksi" && <RotateCcw className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white uppercase tracking-tight">
                  Transaksi {tx.tipe}
                </h1>
                {tx.sudahDibalik && (
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                    Sudah Dikoreksi
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                ID Transaksi: <span className="text-slate-200">{tx.id}</span>
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-500 block">Jumlah Mutasi</span>
            <span
              className={`text-2xl font-extrabold font-mono ${
                tx.jumlah > 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {tx.jumlah > 0 ? "+" : ""}
              {formatRupiah(tx.jumlah)}
            </span>
          </div>
        </div>

        {/* Reversal Alert if applicable */}
        {tx.sudahDibalik && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-semibold">Transaksi Ini Telah Dikoreksi / Dibalik</p>
              <p className="text-[11px] text-rose-400/80 mt-0.5">
                Transaksi pembatalan dibuat pada ID Transaksi #{tx.dibalikOlehId}.
              </p>
            </div>
          </div>
        )}

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              Nasabah
            </span>
            <p className="text-sm font-bold text-slate-200">{tx.customerNama}</p>
            <p className="text-xs text-slate-400 font-mono">@{tx.customerUsername}</p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Diproses Oleh
            </span>
            <p className="text-sm font-bold text-slate-200">{tx.dibuatOlehNama}</p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Waktu Transaksi
            </span>
            <p className="text-sm font-bold text-slate-200 font-mono">
              {new Date(tx.waktu).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              WIB
            </p>
          </div>
        </div>

        {/* Items list if setor */}
        {tx.items.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-400" />
              Rincian Barang Timbangan
            </h3>
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/80">
              {tx.items.map((item, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-200">{item.namaSampah}</p>
                    <p className="text-slate-500 font-mono mt-0.5">
                      {item.berat} kg &times; {formatRupiah(item.hargaSnapshot)}/kg
                    </p>
                  </div>
                  <span className="font-bold text-emerald-400 font-mono text-sm">
                    {formatRupiah(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photo view if photoUrl exists */}
        {tx.fotoUrl && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              Foto Timbangan Terlampir
            </h3>
            <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-2">
              <img
                src={tx.fotoUrl}
                alt="Foto timbangan"
                className="w-full h-auto rounded-xl object-cover"
              />
            </div>
          </div>
        )}

        {/* Koreksi Action for Super Admin */}
        {isSuperAdmin && !tx.sudahDibalik && tx.tipe !== "koreksi" && (
          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <KoreksiDialog transaksiId={tx.id} />
          </div>
        )}
      </div>
    </div>
  );
}
