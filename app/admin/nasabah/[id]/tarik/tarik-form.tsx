"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { actions } from "@/lib/api/actions";
import { type NasabahRingkas, formatRupiah, ERROR_MESSAGES } from "@/contract";
import { ArrowLeft, Loader2, Wallet } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";
import { HasilTransaksi } from "@/components/hasil-transaksi";

/** Data nasabah datang dari Server Component (page.tsx). */
export function TarikForm({
  customerId,
  nasabah,
}: {
  customerId: string;
  nasabah: NasabahRingkas;
}) {

  // Idempotency UUID created once per form open
  const clientRequestIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000"
  );

  const [jumlah, setJumlah] = useState<string>("");
  const [catatan, setCatatan] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [successData, setSuccessData] = useState<{
    saldoBaru: number;
    duplikat: boolean;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const valJumlah = parseInt(jumlah, 10);
    if (isNaN(valJumlah) || valJumlah <= 0) {
      setErrorMessage("Masukkan jumlah penarikan yang valid (minimal Rp1).");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setFieldErrors({});

    try {
      const res = await actions.tarik({
        customerId,
        jumlah: valJumlah,
        catatan: catatan || undefined,
        clientRequestId: clientRequestIdRef.current,
      });

      if (!res.ok) {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        setErrorMessage(res.message || ERROR_MESSAGES[res.code]);
      } else {
        setSuccessData({
          saldoBaru: res.data.saldoBaru,
          duplikat: res.data.duplikat,
        });
      }
    } catch {
      setErrorMessage(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  }

  if (successData) {
    return (
      <HasilTransaksi
        judul="Penarikan saldo tercatat"
        keterangan={
          <>
            Uang tunai diserahkan ke <span className="font-medium text-ink">{nasabah?.nama}</span>.
          </>
        }
        saldoBaru={successData.saldoBaru}
        duplikat={successData.duplikat}
        aksi={
          <>
            <button
              type="button"
              onClick={() => {
                setSuccessData(null);
                clientRequestIdRef.current = crypto.randomUUID();
                setJumlah("");
                setCatatan("");
              }}
              className={buttonClass("secondary", "lg")}
            >
              Tarik lagi
            </button>
            <Link href={`/admin/nasabah/${customerId}`} className={buttonClass("primary", "lg")}>
              Kembali ke nasabah
            </Link>
          </>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href={`/admin/nasabah/${customerId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Batal, kembali ke nasabah
      </Link>

      <PageHeader
        title="Tarik saldo tunai"
        description={
          nasabah && (
            <>
              Nasabah <span className="font-medium text-ink">{nasabah.nama}</span> ·{" "}
              <span className="tabular-nums">{nasabah.username}</span>
            </>
          )
        }
      />

      {nasabah && (
        <Card className="flex items-center justify-between gap-4 px-5 py-4">
          <span className="flex items-center gap-2 text-sm text-ink-muted">
            <Wallet className="size-4" aria-hidden="true" />
            Saldo saat ini
          </span>
          <span className="text-xl font-semibold text-ink tabular-nums">{formatRupiah(nasabah.saldo)}</span>
        </Card>
      )}

      {errorMessage && (
        <Alert tone="danger" title={errorMessage}>
          {nasabah && (
            <>
              Saldo tersedia: <span className="font-semibold tabular-nums">{formatRupiah(nasabah.saldo)}</span>
            </>
          )}
        </Alert>
      )}

      <Card className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Jumlah penarikan (Rp)" htmlFor="tarik-jumlah" required error={fieldErrors.jumlah?.join(", ")}>
            <Input
              id="tarik-jumlah"
              type="number"
              inputMode="numeric"
              required
              min={1}
              placeholder="contoh: 50000"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              aria-invalid={fieldErrors.jumlah ? true : undefined}
              className="tabular-nums"
            />
          </Field>

          <Field label="Catatan (opsional)" htmlFor="tarik-catatan">
            <Textarea
              id="tarik-catatan"
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Keterangan penarikan tunai"
            />
          </Field>

          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                <span>Memproses penarikan…</span>
              </>
            ) : (
              <span>Konfirmasi penarikan</span>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
