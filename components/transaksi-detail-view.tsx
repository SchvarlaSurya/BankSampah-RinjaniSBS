import Link from "next/link";
import { ArrowLeft, ImageIcon, Scale } from "lucide-react";
import { formatRupiah, type TransaksiDetail } from "@/contract";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { BadgeTipe, formatWaktuWib, IkonTipe, JumlahTransaksi } from "@/components/transaksi-tampilan";

/**
 * Tampilan detail transaksi (admin & nasabah). Presentasional: data & aksi dari halaman server.
 * `admin` = tampilkan data nasabah dan status koreksi seperti versi sebelumnya; foto hanya
 * muncul bila server mengirim fotoUrl (super_admin).
 */
export function TransaksiDetailView({
  tx,
  kembali,
  admin,
  aksi,
}: {
  tx: TransaksiDetail;
  kembali: { href: string; label: string };
  admin: boolean;
  aksi?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={kembali.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {kembali.label}
      </Link>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <IkonTipe tipe={tx.tipe} besar />
            <div className="space-y-1">
              <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
                Transaksi <BadgeTipe tipe={tx.tipe} />
                {admin && tx.sudahDibalik && <Badge tone="danger">Sudah dikoreksi</Badge>}
              </h2>
              <p className="text-sm text-ink-muted">
                ID transaksi <span className="font-medium text-ink tabular-nums">{tx.id}</span>
              </p>
            </div>
          </div>
          <JumlahTransaksi jumlah={tx.jumlah} className="text-2xl" />
        </div>

        {admin && tx.sudahDibalik && (
          <div className="px-5 pb-5 sm:px-6">
            <Alert tone="warning" title="Transaksi ini sudah dikoreksi">
              Transaksi pembatalan dibuat pada ID transaksi <span className="font-semibold tabular-nums">#{tx.dibalikOlehId}</span>.
            </Alert>
          </div>
        )}

        <dl className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
          {admin && (
            <div className="bg-surface px-5 py-4 sm:px-6">
              <dt className="text-xs text-ink-muted">Nasabah</dt>
              <dd className="mt-0.5 font-medium text-ink">{tx.customerNama}</dd>
              <dd className="text-sm text-ink-muted tabular-nums">@{tx.customerUsername}</dd>
            </div>
          )}
          <div className="bg-surface px-5 py-4 sm:px-6">
            <dt className="text-xs text-ink-muted">Diproses oleh</dt>
            <dd className="mt-0.5 font-medium text-ink">{tx.dibuatOlehNama}</dd>
          </div>
          <div className={`bg-surface px-5 py-4 sm:px-6 ${admin ? "" : "sm:col-span-2"}`}>
            <dt className="text-xs text-ink-muted">Waktu</dt>
            <dd className="mt-0.5 font-medium text-ink tabular-nums">{formatWaktuWib(tx.waktu)}</dd>
          </div>
        </dl>
      </Card>

      {tx.items.length > 0 && (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Scale className="size-4 text-ink-muted" aria-hidden="true" />
                Rincian barang
              </span>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted">
                <tr className="text-left text-xs text-ink-muted">
                  <th className="h-10 px-5 font-medium">Barang</th>
                  <th className="h-10 px-5 text-right font-medium">Berat × harga</th>
                  <th className="h-10 px-5 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {tx.items.map((item, idx) => (
                  <tr key={idx} className="border-t border-line">
                    <td className="h-11 px-5 text-ink">{item.namaSampah}</td>
                    <td className="h-11 px-5 text-right whitespace-nowrap text-ink-muted tabular-nums">
                      {item.berat} kg × {formatRupiah(item.hargaSnapshot)}/kg
                    </td>
                    <td className="h-11 px-5 text-right font-medium whitespace-nowrap text-ink tabular-nums">
                      {formatRupiah(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tx.fotoUrl && (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ImageIcon className="size-4 text-ink-muted" aria-hidden="true" />
                Foto timbangan
              </span>
            }
            description="Tautan foto berlaku singkat; muat ulang halaman bila foto tidak tampil."
          />
          <div className="p-5 sm:p-6">
            <a href={tx.fotoUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-control border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL foto bertanda tangan berumur 5 menit; next/image tidak cocok. */}
              <img src={tx.fotoUrl} alt={`Foto timbangan transaksi ${tx.id}`} className="max-h-[28rem] w-full bg-surface-muted object-contain" />
            </a>
          </div>
        </Card>
      )}

      {aksi}
    </div>
  );
}
