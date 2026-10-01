import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { queries } from "@/lib/api/queries";
import { formatRupiah, redirectUntukError } from "@/contract";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, RotateCcw, Calendar, Scale } from "lucide-react";

export default async function NasabahTransaksiDetailPage({
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/nasabah"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Dashboard Saya</span>
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div
              className={`p-3 rounded-2xl border ${
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
              <h1 className="text-xl font-bold text-white capitalize">
                Transaksi {tx.tipe}
              </h1>
              <p className="text-xs text-slate-400 font-mono">ID: {tx.id}</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500 block">Jumlah</span>
            <span
              className={`text-xl font-extrabold font-mono ${
                tx.jumlah > 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {tx.jumlah > 0 ? "+" : ""}
              {formatRupiah(tx.jumlah)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-slate-500 block mb-1">Petugas Pembantu</span>
            <p className="font-bold text-slate-200">{tx.dibuatOlehNama}</p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-slate-500 block mb-1">Waktu Transaksi</span>
            <p className="font-bold text-slate-200 font-mono">
              {new Date(tx.waktu).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              WIB
            </p>
          </div>
        </div>

        {tx.items.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-400" />
              Rincian Barang Sampah
            </h3>
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800">
              {tx.items.map((item, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-200">{item.namaSampah}</p>
                    <p className="text-slate-500 font-mono mt-0.5">
                      {item.berat} kg &times; {formatRupiah(item.hargaSnapshot)}/kg
                    </p>
                  </div>
                  <span className="font-bold text-emerald-400 font-mono">
                    {formatRupiah(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
