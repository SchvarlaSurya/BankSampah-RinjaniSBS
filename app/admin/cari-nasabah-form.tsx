"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Loader2 } from "lucide-react";

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
      onSubmit={(e) => {
        e.preventDefault();
        cari(query);
      }}
      className="flex flex-col sm:flex-row gap-3 pt-2"
    >
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ketik nama atau ID nasabah (contoh: nasabah01)..."
          className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 placeholder-slate-500 text-sm rounded-xl pl-10 pr-4 py-3 outline-none transition-all"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm rounded-xl px-5 py-3 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 shrink-0"
      >
        {pending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <span>Cari</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
