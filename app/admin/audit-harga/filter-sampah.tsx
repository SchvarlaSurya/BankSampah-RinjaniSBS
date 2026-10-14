"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah, type JenisSampah } from "@/contract";

/** Filter jenis sampah: hanya mengubah ?sampah= di URL; data dibaca ulang oleh Server Component. */
export function FilterSampah({ wasteTypes, terpilih }: { wasteTypes: JenisSampah[]; terpilih: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pilih(id: string) {
    startTransition(() => {
      router.replace(id ? `/admin/audit-harga?sampah=${encodeURIComponent(id)}` : "/admin/audit-harga");
    });
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      <select
        value={terpilih}
        disabled={pending}
        onChange={(e) => pilih(e.target.value)}
        className="w-full sm:w-80 bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500 transition-colors"
      >
        <option value="">Semua Jenis Sampah</option>
        {wasteTypes.map((w) => (
          <option key={w.id} value={w.id}>
            {w.nama} ({formatRupiah(w.hargaBeli)}/kg)
          </option>
        ))}
      </select>

      {terpilih && (
        <button onClick={() => pilih("")} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
          Reset Filter
        </button>
      )}
    </div>
  );
}
