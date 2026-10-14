import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { queries } from "@/lib/api/queries";
import { formatRupiah, ERROR_MESSAGES, redirectUntukError, LIMIT } from "@/contract";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  History,
  SlidersHorizontal,
  UserCheck,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Stat } from "@/components/ui/page";
import { BarisTransaksi } from "@/components/transaksi-tampilan";
import ResetPasswordDialog from "@/components/ResetPasswordDialog";

export const dynamic = "force-dynamic";

export default async function AdminNasabahDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cursor?: string; prev?: string }>;
}) {
  const { id } = await params;
  const { cursor, prev } = await searchParams;

  const [sesi, nasabahRes] = await Promise.all([
    queries.getSesi(),
    queries.getNasabah({ customerId: id }),
  ]);

  if (!nasabahRes.ok) {
    const redir = redirectUntukError(nasabahRes.code);
    if (redir) redirect(redir);
    if (nasabahRes.code === "NASABAH_TIDAK_DITEMUKAN") notFound();
    return <Alert tone="danger">{nasabahRes.message || ERROR_MESSAGES[nasabahRes.code]}</Alert>;
  }

  const isSuperAdmin = sesi?.role === "super_admin";
  const nasabah = nasabahRes.data;
  const limit = LIMIT.HISTORI_DEFAULT;
  const historiRes = await queries.getHistori({
    customerId: id,
    cursor: cursor || undefined,
    limit,
  });

  const historiItems = historiRes.ok ? historiRes.data.items : [];
  const nextCursor = historiRes.ok ? historiRes.data.nextCursor : null;
  const hasHistoriError = !historiRes.ok;

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Kembali ke pencarian
      </Link>

      {/* Profil + saldo + aksi */}
      <Card>
        <div className="flex flex-col gap-6 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-muted text-lg font-semibold text-ink ring-1 ring-line ring-inset">
              {nasabah.nama.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 space-y-1.5">
              <h2 className="text-xl font-semibold text-ink sm:text-2xl">{nasabah.nama}</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <span>
                  ID Nasabah <span className="font-medium text-ink tabular-nums">{nasabah.username}</span>
                </span>
                <Badge tone={nasabah.aktif ? "success" : "danger"}>
                  {nasabah.aktif ? <UserCheck aria-hidden="true" /> : <UserX aria-hidden="true" />}
                  {nasabah.aktif ? "Aktif" : "Nonaktif"}
                </Badge>
                {isSuperAdmin && (
                  <ResetPasswordDialog
                    userId={nasabah.id}
                    username={nasabah.username}
                    nama={nasabah.nama}
                    role="nasabah"
                    varian="kecil"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="rounded-control bg-surface-muted px-5 py-4 ring-1 ring-line ring-inset md:min-w-60">
            <Stat label="Saldo saat ini" value={formatRupiah(nasabah.saldo)} emphasis />
          </div>
        </div>

        <div className="grid gap-3 border-t border-line p-5 sm:grid-cols-3 sm:p-6">
          <Link href={`/admin/nasabah/${nasabah.id}/setor`} className={buttonClass("primary", "lg")}>
            <ArrowDownLeft aria-hidden="true" />
            Setor sampah
          </Link>
          <Link href={`/admin/nasabah/${nasabah.id}/tarik`} className={buttonClass("secondary", "lg")}>
            <ArrowUpRight aria-hidden="true" />
            Tarik saldo
          </Link>
          <Link href={`/admin/nasabah/${nasabah.id}/penyesuaian`} className={buttonClass("secondary", "lg")}>
            <SlidersHorizontal aria-hidden="true" />
            Penyesuaian saldo
          </Link>
        </div>
      </Card>

      {/* Riwayat */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <History className="size-4 text-ink-muted" aria-hidden="true" />
              Riwayat transaksi
            </span>
          }
          actions={cursor ? <span className="text-xs text-ink-muted">Halaman berikutnya</span> : undefined}
        />

        {hasHistoriError ? (
          <div className="p-5">
            <Alert tone="danger">
              {!historiRes.ok
                ? historiRes.message || ERROR_MESSAGES[historiRes.code]
                : "Gagal memuat riwayat transaksi."}
            </Alert>
          </div>
        ) : historiItems.length === 0 ? (
          <EmptyState
            icon={<History />}
            title={cursor ? "Tidak ada transaksi lagi" : "Belum ada transaksi"}
            description={
              cursor
                ? "Tidak ada transaksi lagi pada halaman ini."
                : "Riwayat akan muncul setelah setor, tarik, atau penyesuaian pertama."
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {historiItems.map((tx) => (
              <BarisTransaksi key={tx.id} tx={tx} href={`/admin/transaksi/${tx.id}`} />
            ))}
          </ul>
        )}

        {(cursor || nextCursor) && (
          <nav aria-label="Halaman riwayat" className="flex items-center justify-between border-t border-line px-5 py-3">
            <Link
              href={
                prev
                  ? `/admin/nasabah/${id}?cursor=${prev}`
                  : `/admin/nasabah/${id}`
              }
              aria-disabled={!cursor}
              className={buttonClass("ghost", "md", cursor ? "" : "pointer-events-none opacity-40")}
            >
              <ChevronLeft aria-hidden="true" />
              Sebelumnya
            </Link>

            <Link
              href={
                nextCursor
                  ? `/admin/nasabah/${id}?cursor=${nextCursor}${cursor ? `&prev=${cursor}` : ""}`
                  : "#"
              }
              aria-disabled={!nextCursor}
              className={buttonClass("ghost", "md", nextCursor ? "" : "pointer-events-none opacity-40")}
            >
              {nextCursor && !cursor ? "Muat lebih banyak" : "Berikutnya"}
              <ChevronRight aria-hidden="true" />
            </Link>
          </nav>
        )}
      </Card>
    </div>
  );
}
