"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

/** Form pencarian: hanya mengubah ?q= di URL; data dibaca ulang oleh Server Component. */
export function CariNasabahForm({ awal }: { awal: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(awal);
  const [pending, startTransition] = useTransition();

  function cari(q: string) {
    const trimmed = q.trim();
    startTransition(() => {
      router.replace(trimmed ? `/admin?q=${encodeURIComponent(trimmed)}` : "/admin");
    });
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        cari(query);
      }}
      className="flex flex-col gap-3 sm:flex-row"
    >
      <label htmlFor="cari-nasabah" className="sr-only">
        Cari nasabah berdasarkan ID atau nama
      </label>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
        <input
          id="cari-nasabah"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ID nasabah (mis. 0101) atau nama"
          className={`${inputClass} pl-10`}
        />
      </div>
      <Button type="submit" disabled={pending} className="h-11 sm:w-28">
        {pending ? <Loader2 className="animate-spin" /> : "Cari"}
      </Button>
    </form>
  );
}
