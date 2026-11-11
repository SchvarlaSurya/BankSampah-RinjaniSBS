import { redirect } from "next/navigation";
import Link from "next/link";
import { queries } from "@/lib/api/queries";
import { formatRupiah, redirectUntukError, ERROR_MESSAGES, LIMIT } from "@/contract";
import { ChevronLeft, ChevronRight, History, Tags, Wallet } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Stat } from "@/components/ui/page";
import { BarisTransaksi } from "@/components/transaksi-tampilan";
import { Avatar } from "@/components/avatar";

export const dynamic = "force-dynamic";

export default async function NasabahDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; prev?: string }>;
}) {
  const { cursor, prev } = await searchParams;

  const [sesi, profilRes] = await Promise.all([
    queries.getSesi(),
    queries.getProfilSaya(),
  ]);

  if (!sesi) redirect("/login");

  if (!profilRes.ok) {
    const redir = redirectUntukError(profilRes.code);
    if (redir) redirect(redir);
    return <Alert tone="danger">{profilRes.message || ERROR_MESSAGES[profilRes.code]}</Alert>;
  }

  const profil = profilRes.data;
  const limit = LIMIT.HISTORI_DEFAULT;
  const historiRes = await queries.getHistori({
    customerId: profil.id,
    cursor: cursor || undefined,
    limit,
  });

  const historiItems = historiRes.ok ? historiRes.data.items : [];
  const nextCursor = historiRes.ok ? historiRes.data.nextCursor : null;
  const hasHistoriError = !historiRes.ok;

  return (
    <div className="space-y-6">
      {/* Profil + saldo */}
      <Card>
        <div className="flex flex-col gap-6 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <Avatar nama={profil.nama} userId={sesi.userId} fotoVersi={sesi.fotoVersi} ukuran="lg" />
            <div className="min-w-0 space-y-1">
              <h2 className="text-xl font-semibold text-ink sm:text-2xl">{profil.nama}</h2>
              <p className="text-sm text-ink-muted">
                ID Nasabah <span className="font-medium text-ink tabular-nums">{profil.username}</span>
              </p>
            </div>
          </div>

          <div className="rounded-control bg-surface-muted px-5 py-4 ring-1 ring-line ring-inset md:min-w-64">
            <Stat
              label={
                <span className="flex items-center gap-1.5">
                  <Wallet className="size-4" aria-hidden="true" />
                  Saldo tabungan sampah
                </span>
              }
              value={formatRupiah(profil.saldo)}
              emphasis
            />
          </div>
        </div>

        <div className="border-t border-line p-5 sm:p-6">
          <Link href="/nasabah/katalog" className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
            <Tags aria-hidden="true" />
            Lihat katalog harga sampah
            <ChevronRight aria-hidden="true" />
          </Link>
        </div>
      </Card>

      {/* Riwayat */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <History className="size-4 text-ink-muted" aria-hidden="true" />
              Riwayat transaksi saya
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
                : "Riwayat akan muncul setelah setoran sampah pertama Anda."
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {historiItems.map((tx) => (
              <BarisTransaksi key={tx.id} tx={tx} href={`/nasabah/transaksi/${tx.id}`} />
            ))}
          </ul>
        )}

        {(cursor || nextCursor) && (
          <nav aria-label="Halaman riwayat" className="flex items-center justify-between border-t border-line px-5 py-3">
            <Link
              href={
                prev
                  ? `/nasabah?cursor=${prev}`
                  : `/nasabah`
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
                  ? `/nasabah?cursor=${nextCursor}${cursor ? `&prev=${cursor}` : ""}`
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
