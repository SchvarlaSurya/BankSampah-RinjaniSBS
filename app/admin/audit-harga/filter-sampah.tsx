"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah, type JenisSampah } from "@/contract";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";

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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label htmlFor="filter-sampah" className="sr-only">
        Filter jenis sampah
      </label>
      <Select
        id="filter-sampah"
        value={terpilih}
        disabled={pending}
        onChange={(e) => pilih(e.target.value)}
        className="sm:w-80"
      >
        <option value="">Semua Jenis Sampah</option>
        {wasteTypes.map((w) => (
          <option key={w.id} value={w.id}>
            {w.nama} ({formatRupiah(w.hargaBeli)}/kg)
          </option>
        ))}
      </Select>

      {terpilih && (
        <Button variant="secondary" onClick={() => pilih("")}>
          Reset filter
        </Button>
      )}
    </div>
  );
}
