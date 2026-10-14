"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { actions } from "@/lib/api/actions";
import { ERROR_MESSAGES, LIMIT } from "@/contract";
import { RotateCcw, TriangleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Alert, ModalShell } from "@/components/ui/feedback";

export default function KoreksiDialog({ transaksiId }: { transaksiId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientRequestIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000"
  );

  async function handleKoreksi(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (alasan.trim().length < LIMIT.ALASAN_MIN) {
      setErrorMessage(`Alasan minimal ${LIMIT.ALASAN_MIN} karakter.`);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await actions.koreksi({
        transaksiId,
        alasan: alasan.trim(),
        clientRequestId: clientRequestIdRef.current,
      });

      if (!res.ok) {
        setErrorMessage(res.message || ERROR_MESSAGES[res.code]);
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setErrorMessage(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <RotateCcw />
        <span>Koreksi / Dibalikkan (Reversal)</span>
      </Button>

      {open && (
        <ModalShell labelledBy="koreksi-judul" className="max-w-lg">
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger-fg">
                <TriangleAlert className="size-5" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <h2 id="koreksi-judul" className="text-base font-semibold text-ink">
                  Konfirmasi koreksi transaksi
                </h2>
                <p className="text-sm text-ink-muted">
                  Tindakan ini akan membalikkan efek finansial transaksi. Uang nasabah akan disesuaikan secara otomatis di ledger.
                </p>
              </div>
            </div>

            {errorMessage && <Alert tone="danger">{errorMessage}</Alert>}

            <form onSubmit={handleKoreksi} className="space-y-4">
              <Field label="Alasan koreksi" htmlFor="koreksi-alasan" required>
                <Textarea
                  id="koreksi-alasan"
                  rows={3}
                  required
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Jelaskan alasan pembatalan / koreksi transaksi…"
                />
              </Field>

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
                  Batal
                </Button>
                <Button type="submit" variant="danger" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      <span>Memproses…</span>
                    </>
                  ) : (
                    <span>Proses koreksi</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </ModalShell>
      )}
    </>
  );
}
