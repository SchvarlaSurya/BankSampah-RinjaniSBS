"use client";

import { useId, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { ERROR_MESSAGES, LIMIT, type PenggunaDetail } from "@/contract";
import { actions } from "@/lib/api/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert, ModalShell } from "@/components/ui/feedback";

const NAMA_PERAN = { super_admin: "Super Admin", admin: "Admin", nasabah: "Nasabah" } as const;

/**
 * Dialog konfirmasi hapus akun. Pengguna wajib mengetik ID (atau nama) persis dan mengisi alasan.
 * Server mengecek ulang semuanya; dialog ini hanya mencegah salah klik.
 */
export function HapusAkunDialog({
  pengguna,
  onTutup,
  onTerhapus,
}: {
  pengguna: PenggunaDetail;
  onTutup: () => void;
  onTerhapus: (pesan: string) => void;
}) {
  const id = useId();
  const [konfirmasi, setKonfirmasi] = useState("");
  const [alasan, setAlasan] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const cocok = konfirmasi.trim() === pengguna.username || konfirmasi.trim() === pengguna.nama.trim();
  const alasanCukup = alasan.trim().length >= LIMIT.ALASAN_MIN;

  async function hapus() {
    if (loading || !cocok || !alasanCukup) return;
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await actions.hapusPengguna({ userId: pengguna.id, konfirmasi: konfirmasi.trim(), alasan: alasan.trim() });
      if (res.ok) {
        onTerhapus(`Akun ${pengguna.nama} (ID ${res.data.username}) sudah dihapus. ID ini bisa dipakai lagi.`);
        return;
      }
      setFieldErrors(res.fieldErrors ?? {});
      setError(res.message || ERROR_MESSAGES[res.code]);
    } catch {
      setError(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell labelledBy={`${id}-judul`} className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger-fg">
          <Trash2 className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1">
          <h2 id={`${id}-judul`} className="text-lg font-semibold text-ink">
            Hapus akun ini?
          </h2>
          <p className="text-base text-ink-muted">Akun dihapus permanen dan tidak bisa dikembalikan.</p>
        </div>
      </div>

      <dl className="grid gap-px overflow-hidden rounded-control bg-line text-base ring-1 ring-line">
        <div className="flex justify-between gap-3 bg-surface px-4 py-2.5">
          <dt className="text-ink-muted">Nama</dt>
          <dd className="min-w-0 truncate text-right font-medium text-ink">{pengguna.nama}</dd>
        </div>
        <div className="flex justify-between gap-3 bg-surface px-4 py-2.5">
          <dt className="text-ink-muted">ID</dt>
          <dd className="font-semibold text-ink tabular-nums slashed-zero">{pengguna.username}</dd>
        </div>
        <div className="flex justify-between gap-3 bg-surface px-4 py-2.5">
          <dt className="text-ink-muted">Peran</dt>
          <dd className="font-medium text-ink">{NAMA_PERAN[pengguna.role]}</dd>
        </div>
      </dl>

      <Field
        label={
          <>
            Ketik <strong className="font-semibold tabular-nums">{pengguna.username}</strong> untuk memastikan
          </>
        }
        htmlFor={`${id}-konfirmasi`}
        hint="Boleh juga mengetik nama lengkapnya persis."
        error={fieldErrors.konfirmasi?.[0]}
        required
      >
        <Input
          id={`${id}-konfirmasi`}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={konfirmasi}
          onChange={(e) => setKonfirmasi(e.target.value)}
          className="h-12 text-base"
        />
      </Field>

      <Field
        label="Alasan menghapus"
        htmlFor={`${id}-alasan`}
        hint={`Wajib, minimal ${LIMIT.ALASAN_MIN} karakter. Contoh: salah input, akun dobel.`}
        error={fieldErrors.alasan?.[0]}
        required
      >
        <Textarea
          id={`${id}-alasan`}
          maxLength={LIMIT.ALASAN_MAKS}
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          className="text-base"
        />
      </Field>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="lg" onClick={onTutup} disabled={loading} className="w-full sm:w-auto">
          Batal
        </Button>
        <Button variant="danger" size="lg" onClick={hapus} disabled={loading || !cocok || !alasanCukup} className="w-full sm:w-auto">
          {loading ? <Loader2 className="animate-spin" /> : <Trash2 />}
          <span>{loading ? "Menghapus…" : "Ya, hapus akun"}</span>
        </Button>
      </div>
    </ModalShell>
  );
}
