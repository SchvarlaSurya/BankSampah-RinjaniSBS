import { CheckCircle2 } from "lucide-react";
import { formatRupiah } from "@/contract";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";

/** Layar hasil transaksi (setor/tarik/penyesuaian). Presentasional; aksi dikirim pemanggil. */
export function HasilTransaksi({
  judul,
  keterangan,
  saldoBaru,
  duplikat,
  aksi,
}: {
  judul: string;
  keterangan: React.ReactNode;
  saldoBaru: number;
  duplikat: boolean;
  aksi: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg py-6 sm:py-10">
      <Card className="p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-success-bg text-success-fg">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-ink" role="status">
          {judul}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{keterangan}</p>
        {duplikat && (
          <Alert tone="info" className="mt-4 text-left">
            Permintaan ini sudah pernah diproses sebelumnya; tidak ada transaksi ganda.
          </Alert>
        )}
        <div className="mt-6 rounded-control bg-surface-muted px-5 py-4 ring-1 ring-line ring-inset">
          <p className="text-sm text-ink-muted">Saldo nasabah sekarang</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-ink tabular-nums">{formatRupiah(saldoBaru)}</p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">{aksi}</div>
      </Card>
    </div>
  );
}
