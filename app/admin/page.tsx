import Link from "next/link";
import { redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { formatRupiah, redirectUntukError, type NasabahRingkas } from "@/contract";
import { Search, UserCheck, Wallet, ArrowRight, UserX, AlertCircle } from "lucide-react";
import { CariNasabahForm } from "./cari-nasabah-form";

/** Minimal 2 karakter (CariNasabahInputSchema); di bawah itu tidak memanggil query. */
const MIN_QUERY = 2;

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).q;
  const query = (typeof raw === "string" ? raw : "").trim();

  let nasabahList: NasabahRingkas[] = [];
  let errorMessage: string | null = null;
  if (query.length >= MIN_QUERY) {
    const res = await queries.cariNasabah({ query });
    if (res.ok) {
      nasabahList = res.data;
    } else {
      const redir = redirectUntukError(res.code);
      if (redir) redirect(redir);
      errorMessage = res.message;
    }
  }

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

          <CariNasabahForm awal={query} />
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

        {query.length < MIN_QUERY ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-400 space-y-3">
            <Search className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="font-semibold text-sm">Ketik minimal {MIN_QUERY} karakter untuk mencari</p>
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
