import Link from "next/link";
import { redirect } from "next/navigation";
import { queries } from "@/lib/api/queries";
import {
  type RiwayatHargaItem,
  type JenisSampah,
  formatRupiah,
  redirectUntukError,
} from "@/contract";
import { ArrowLeft, ArrowRight, History, Loader2, Tags, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";
import { formatWaktuWib } from "@/components/transaksi-tampilan";
import { FilterSampah } from "./filter-sampah";

export default async function AuditHargaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).sampah;
  const selectedSampahId = typeof raw === "string" ? raw : "";

  const [logRes, jenisRes] = await Promise.all([
    queries.listRiwayatHarga({ sampahId: selectedSampahId || undefined }),
    queries.listJenisSampah({ termasukNonaktif: true }),
  ]);
  let logs: RiwayatHargaItem[] = [];
  let authError: string | null = null;
  let errorMessage: string | null = null;
  if (logRes.ok) {
    logs = logRes.data;
  } else {
    const redir = redirectUntukError(logRes.code);
    if (redir) redirect(redir);
    if (logRes.code === "TIDAK_DIIZINKAN") authError = "Halaman audit ini hanya dapat diakses oleh Super Admin.";
    else errorMessage = logRes.message;
  }
  const wasteTypes: JenisSampah[] = jenisRes.ok ? jenisRes.data : [];
  const loading = false;

  if (authError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert tone="danger">{authError}</Alert>
        <Link href="/admin" className={buttonClass("secondary")}>
          <ArrowLeft aria-hidden="true" />
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Rekaman kronologis setiap perubahan harga sampah oleh Admin maupun Super Admin, untuk transparansi dan akuntabilitas."
        actions={
          <Link href="/admin/jenis-sampah" className={buttonClass("secondary")}>
            <Tags aria-hidden="true" />
            Kelola katalog sampah
          </Link>
        }
      />

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">Filter jenis sampah</p>
          <span className="text-xs text-ink-muted tabular-nums">{logs.length} catatan riwayat</span>
        </div>
        <FilterSampah wasteTypes={wasteTypes} terpilih={selectedSampahId} />
      </Card>

      {errorMessage && <Alert tone="danger">{errorMessage}</Alert>}

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <History className="size-4 text-ink-muted" aria-hidden="true" />
              Riwayat perubahan harga
            </span>
          }
        />
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            <span>Memuat data riwayat perubahan harga…</span>
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={<History />}
            title="Belum ada riwayat perubahan harga"
            description="Setiap kali harga sampah diubah pada menu Jenis Sampah, catatan perubahannya otomatis muncul di sini."
          />
        ) : (
          <ul className="divide-y divide-line">
            {logs.map((log) => {
              const selisih = log.hargaBaru - log.hargaLama;
              const isNaik = selisih > 0;
              const isAwal = log.hargaLama === 0;

              return (
                <li
                  key={log.id}
                  className="flex flex-col gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-brand-soft sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium text-ink">{log.sampahNama}</p>
                    <p className="text-sm text-ink-muted">
                      <span className="tabular-nums">{formatWaktuWib(log.createdAt)}</span>
                      {" · "}
                      {log.diubahOlehNama} <span className="text-ink-subtle">@{log.diubahOlehUsername}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end">
                    <span className="flex items-center gap-2 text-sm whitespace-nowrap tabular-nums">
                      {isAwal ? (
                        <span className="text-ink-muted">Harga awal</span>
                      ) : (
                        <span className="text-ink-muted">{formatRupiah(log.hargaLama)}</span>
                      )}
                      <ArrowRight className="size-3.5 text-ink-subtle" aria-label="menjadi" />
                      <span className="font-semibold text-ink">{formatRupiah(log.hargaBaru)}</span>
                    </span>
                    {isAwal ? (
                      <Badge tone="info">Baru dibuat</Badge>
                    ) : isNaik ? (
                      <Badge tone="success">
                        <TrendingUp aria-hidden="true" />
                        <span className="tabular-nums">Naik +{formatRupiah(selisih)}</span>
                      </Badge>
                    ) : (
                      <Badge tone="warning">
                        <TrendingDown aria-hidden="true" />
                        <span className="tabular-nums">Turun {formatRupiah(selisih)}</span>
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
