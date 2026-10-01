import { redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { formatRupiah, redirectUntukError } from "@/contract";
import { FileCheck, Calendar, User, Scale, ImageIcon } from "lucide-react";

export default async function AuditTransaksiPage() {
  const [sesi, auditRes] = await Promise.all([
    queries.getSesi(),
    queries.auditTransaksi({ limit: 50 }),
  ]);

  if (!sesi) redirect("/login");
  if (sesi.role !== "super_admin") redirect("/admin");

  if (!auditRes.ok) {
    const redir = redirectUntukError(auditRes.code);
    if (redir) redirect(redir);
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
        {auditRes.message}
      </div>
    );
  }

  const items = auditRes.data.items;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-3 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <FileCheck className="w-3.5 h-3.5" />
          <span>Super Admin Audit Mode</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Audit Transaksi & Foto Timbangan</h1>
        <p className="text-xs text-slate-400 max-w-xl">
          Log pemeriksaan transaksi lengkap dengan perbandingan foto timbangan dan rincian barang.
        </p>
      </div>

      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="py-12 bg-slate-900/60 border border-slate-800 rounded-3xl text-center text-slate-500 text-sm">
            Belum ada log audit transaksi.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((tx) => (
              <div
                key={tx.id}
                className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-lg flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold capitalize">
                      {tx.tipe}
                    </span>
                    <span
                      className={`text-base font-extrabold font-mono ${
                        tx.jumlah > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {tx.jumlah > 0 ? "+" : ""}
                      {formatRupiah(tx.jumlah)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Nasabah</span>
                      <span className="font-semibold text-slate-200">{tx.customerNama}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Petugas</span>
                      <span className="font-semibold text-slate-200">{tx.dibuatOlehNama}</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 font-mono">
                    {new Date(tx.waktu).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    WIB
                  </div>
                </div>

                {tx.fotoUrl && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-2">
                    <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                      Foto Timbangan Validasi
                    </span>
                    <div className="w-full h-48 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                      <img
                        src={tx.fotoUrl}
                        alt="Audit Foto"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
