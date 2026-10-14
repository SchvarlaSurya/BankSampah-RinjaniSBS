"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { actions } from "@/lib/api/actions";
import { ERROR_MESSAGES, LIMIT, formatRupiah, type NasabahRingkas } from "@/contract";
import { ArrowLeft, Loader2, Minus, Plus, Wallet } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";
import { HasilTransaksi } from "@/components/hasil-transaksi";
import { cn } from "@/lib/utils";

type Arah = "tambah" | "kurangi";

/**
 * Penyesuaian saldo (admin & super_admin): dicatat sebagai transaksi baru bertipe "penyesuaian"
 * dengan alasan wajib, bukan mengubah angka saldo. Data nasabah dari Server Component (page.tsx).
 */
export function PenyesuaianForm({ customerId, nasabah }: { customerId: string; nasabah: NasabahRingkas }) {
  // UUID idempotensi dibuat sekali per form terbuka, dipakai ulang saat "coba lagi".
  const clientRequestIdRef = useRef<string>(crypto.randomUUID());

  const [arah, setArah] = useState<Arah>("tambah");
  const [jumlah, setJumlah] = useState("");
  const [alasan, setAlasan] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [hasil, setHasil] = useState<{ saldoBaru: number; duplikat: boolean; jumlah: number } | null>(null);

  const nilai = Number.parseInt(jumlah, 10);
  const nilaiValid = Number.isInteger(nilai) && nilai > 0;
  const bertanda = nilaiValid ? (arah === "tambah" ? nilai : -nilai) : 0;
  const perkiraanSaldo = nasabah.saldo + bertanda;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErrorMessage(null);
    setFieldErrors({});

    if (!nilaiValid) {
      setErrorMessage("Masukkan jumlah penyesuaian yang valid (minimal Rp1).");
      return;
    }
    if (perkiraanSaldo < 0) {
      setErrorMessage(ERROR_MESSAGES.SALDO_TIDAK_CUKUP);
      return;
    }

    setLoading(true);
    try {
      const res = await actions.sesuaikanSaldo({
        customerId,
        jumlah: bertanda,
        alasan,
        clientRequestId: clientRequestIdRef.current,
      });
      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        const pesanField = res.fieldErrors ? Object.values(res.fieldErrors).flat()[0] : undefined;
        setErrorMessage(pesanField || res.message);
      } else {
        setHasil({ saldoBaru: res.data.saldoBaru, duplikat: res.data.duplikat, jumlah: res.data.transaksi.jumlah });
      }
    } catch {
      setErrorMessage(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  }

  if (hasil) {
    return (
      <HasilTransaksi
        judul="Penyesuaian saldo tercatat"
        keterangan={
          <>
            {hasil.jumlah >= 0 ? "Penambahan" : "Pengurangan"}{" "}
            <span className="font-medium text-ink tabular-nums">{formatRupiah(Math.abs(hasil.jumlah))}</span> untuk{" "}
            <span className="font-medium text-ink">{nasabah.nama}</span>.
          </>
        }
        saldoBaru={hasil.saldoBaru}
        duplikat={hasil.duplikat}
        aksi={
          <Link href={`/admin/nasabah/${customerId}`} className={buttonClass("primary", "lg", "sm:col-span-2")}>
            Kembali ke nasabah
          </Link>
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
        title="Penyesuaian saldo"
        description={
          <>
            Nasabah <span className="font-medium text-ink">{nasabah.nama}</span> ·{" "}
            <span className="tabular-nums">{nasabah.username}</span>
          </>
        }
      />

      <Alert tone="info">
        Saldo tidak diubah langsung: penyesuaian dicatat sebagai transaksi baru (petugas, waktu, alasan) dan tampil di
        riwayat serta audit. Kesalahan penyesuaian dibetulkan super admin lewat koreksi.
      </Alert>

      <Card className="flex items-center justify-between gap-4 px-5 py-4">
        <span className="flex items-center gap-2 text-sm text-ink-muted">
          <Wallet className="size-4" aria-hidden="true" />
          Saldo saat ini
        </span>
        <span className="text-xl font-semibold text-ink tabular-nums">{formatRupiah(nasabah.saldo)}</span>
      </Card>

      {errorMessage && <Alert tone="danger">{errorMessage}</Alert>}

      <Card className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-2 rounded-control bg-surface-muted p-1 ring-1 ring-line ring-inset" role="radiogroup" aria-label="Jenis penyesuaian">
            {(["tambah", "kurangi"] as const).map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={arah === a}
                onClick={() => setArah(a)}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-[6px] text-sm font-semibold transition-colors duration-150",
                  arah === a ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-ink-muted hover:text-ink",
                )}
              >
                {a === "tambah" ? <Plus className="size-4" /> : <Minus className="size-4" />}
                {a === "tambah" ? "Tambah saldo" : "Kurangi saldo"}
              </button>
            ))}
          </div>

          <Field
            label="Jumlah (Rp)"
            htmlFor="jumlah"
            required
            error={fieldErrors.jumlah?.join(", ")}
            hint={
              nilaiValid ? (
                <span className={perkiraanSaldo < 0 ? "text-danger-fg" : undefined}>
                  Perkiraan saldo setelahnya: <span className="font-semibold tabular-nums">{formatRupiah(perkiraanSaldo)}</span>
                </span>
              ) : undefined
            }
          >
            <Input
              id="jumlah"
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={LIMIT.MAKS_TARIK_RUPIAH}
              placeholder="contoh: 25000"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              aria-invalid={fieldErrors.jumlah ? true : undefined}
              className="tabular-nums"
            />
          </Field>

          <Field label="Alasan" htmlFor="alasan" required error={fieldErrors.alasan?.join(", ")}>
            <Textarea
              id="alasan"
              rows={3}
              required
              minLength={LIMIT.ALASAN_MIN}
              maxLength={LIMIT.ALASAN_MAKS}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="contoh: Saldo awal dari buku tabungan manual per 1 Oktober 2026"
              aria-invalid={fieldErrors.alasan ? true : undefined}
            />
          </Field>

          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                <span>Menyimpan…</span>
              </>
            ) : (
              <span>Simpan penyesuaian</span>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
