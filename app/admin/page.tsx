import Link from "next/link";
import { redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import { formatRupiah, redirectUntukError, type NasabahRingkas } from "@/contract";
import { ChevronRight, Search, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";
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
    <div className="space-y-6">
      <PageHeader description="Temukan nasabah lewat ID atau nama untuk mencatat setor sampah, penarikan, atau penyesuaian saldo." />

      <Card className="p-4 sm:p-5">
        <CariNasabahForm awal={query} />
      </Card>

      {errorMessage && <Alert tone="danger">{errorMessage}</Alert>}

      <Card>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">Hasil pencarian</h2>
          <span className="text-sm text-ink-muted tabular-nums">{nasabahList.length} nasabah</span>
        </div>

        {query.length < MIN_QUERY ? (
          <EmptyState
            icon={<Search />}
            title={`Ketik minimal ${MIN_QUERY} karakter untuk mencari`}
            description="Pencarian cocok dengan awal ID nasabah atau awal nama."
          />
        ) : nasabahList.length === 0 ? (
          <EmptyState
            icon={<UserX />}
            title="Nasabah tidak ditemukan"
            description="Periksa kembali ID nasabah atau coba kata kunci lain."
          />
        ) : (
          <ul className="divide-y divide-line">
            {nasabahList.map((nasabah) => (
              <li key={nasabah.id}>
                <Link
                  href={`/admin/nasabah/${nasabah.id}`}
                  className="flex min-h-16 items-center gap-4 px-5 py-3 transition-colors duration-150 hover:bg-brand-soft focus-visible:bg-brand-soft"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-ink ring-1 ring-line ring-inset">
                    {nasabah.nama.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{nasabah.nama}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                      <span className="tabular-nums">{nasabah.username}</span>
                      <Badge tone={nasabah.aktif ? "success" : "danger"}>{nasabah.aktif ? "Aktif" : "Nonaktif"}</Badge>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-xs text-ink-muted">Saldo</span>
                    <span className="block font-semibold text-ink tabular-nums">{formatRupiah(nasabah.saldo)}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
