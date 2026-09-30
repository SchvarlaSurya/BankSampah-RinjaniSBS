import { redirect } from "next/navigation";
import Link from "next/link";
import { queries } from "@/src/lib/api/queries";
import { formatRupiah, redirectUntukError } from "@/src/contract";
import { Wallet, History, ArrowDownLeft, ArrowUpRight, RotateCcw, ChevronRight, User } from "lucide-react";

export default async function NasabahDashboardPage() {
  const [sesi, profilRes] = await Promise.all([
    queries.getSesi(),
    queries.getProfilSaya(),
  ]);

  if (!sesi) redirect("/login");

  if (!profilRes.ok) {
    const redir = redirectUntukError(profilRes.code);
    if (redir) redirect(redir);
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
        {profilRes.message}
      </div>
    );
  }

  const profil = profilRes.data;
  const historiRes = await queries.getHistori({ customerId: profil.id, limit: 20 });
  const historiItems = historiRes.ok ? historiRes.data.items : [];

  return (
    <div className="space-y-6">
      {/* Profile & Saldo Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{profil.nama}</h1>
              <p className="text-xs text-slate-400 font-mono">
                ID Nasabah: <span className="text-emerald-400 font-semibold">{profil.username}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
              <Wallet className="w-4 h-4 text-emerald-400" />
              Saldo Rekening Tabungan Sampah
            </span>
            <span className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
              {formatRupiah(profil.saldo)}
            </span>
          </div>
        </div>
      </div>

      {/* Histori Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <span>Riwayat Transaksi Saya</span>
          </h2>
        </div>

        {historiItems.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            Belum ada riwayat transaksi.
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
                      <p className="font-semibold text-sm text-slate-200 capitalize">
                        {tx.tipe}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {tx.catatan || `Petugas: ${tx.dibuatOlehNama}`}
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
                    <span
                      className={`text-sm font-bold font-mono ${
                        tx.jumlah > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {tx.jumlah > 0 ? "+" : ""}
                      {formatRupiah(tx.jumlah)}
                    </span>

                    <Link
                      href={`/nasabah/transaksi/${tx.id}`}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
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
