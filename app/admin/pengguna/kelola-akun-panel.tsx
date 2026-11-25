"use client";

import { useState } from "react";
import { Loader2, Trash2, UserCheck, UserX } from "lucide-react";
import { ERROR_MESSAGES, type PenggunaDetail } from "@/contract";
import { actions } from "@/lib/api/actions";
import ResetPasswordDialog from "@/components/ResetPasswordDialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { HapusAkunDialog } from "./hapus-akun-dialog";
import { FotoProfilEditor } from "@/components/akun/foto-profil-editor";

/**
 * Panel "Kelola akun" (super_admin) di bawah baris pengguna. Urutan tetap: Reset password,
 * Nonaktifkan/Aktifkan akun, lalu "Hapus akun" (merah, paling bawah, terpisah).
 * HP: tombol bertumpuk selebar kartu.
 */
export function KelolaAkunPanel({
  pengguna,
  onBerubah,
  onTerhapus,
}: {
  pengguna: PenggunaDetail;
  onBerubah: () => void;
  onTerhapus: (pesan: string) => void;
}) {
  const [hapusTerbuka, setHapusTerbuka] = useState(false);
  const [memprosesStatus, setMemprosesStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ubahStatus() {
    if (memprosesStatus) return;
    setMemprosesStatus(true);
    setError(null);
    try {
      const res = await actions.setStatusPengguna({ userId: pengguna.id, aktif: !pengguna.aktif });
      if (res.ok) onBerubah();
      else setError(res.message || ERROR_MESSAGES[res.code]);
    } catch {
      setError(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setMemprosesStatus(false);
    }
  }

  const alasanTerkunci = pengguna.alasanTidakBisaDihapus ? ERROR_MESSAGES[pengguna.alasanTidakBisaDihapus] : null;

  return (
    <div className="space-y-3 rounded-control bg-surface-muted p-4 ring-1 ring-line ring-inset">
      <p className="text-base font-semibold text-ink">Kelola akun</p>

      <details className="rounded-control bg-surface p-3 ring-1 ring-line ring-inset">
        <summary className="flex min-h-12 cursor-pointer items-center text-base font-medium text-ink">Foto profil</summary>
        <div className="pt-3">
          <FotoProfilEditor userId={pengguna.id} nama={pengguna.nama} fotoVersi={pengguna.fotoVersi} targetUserId={pengguna.id} ringkas />
        </div>
      </details>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {pengguna.role !== "super_admin" && (
          <ResetPasswordDialog
            userId={pengguna.id}
            username={pengguna.username}
            nama={pengguna.nama}
            role={pengguna.role}
            varian="panel"
            onSuccess={onBerubah}
          />
        )}
        <Button variant="secondary" size="lg" onClick={ubahStatus} disabled={memprosesStatus} className="w-full sm:w-auto">
          {memprosesStatus ? <Loader2 className="animate-spin" /> : pengguna.aktif ? <UserX /> : <UserCheck />}
          <span>{pengguna.aktif ? "Nonaktifkan akun" : "Aktifkan akun"}</span>
        </Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="space-y-2 border-t border-line pt-3">
        <Button
          variant="danger"
          size="lg"
          onClick={() => setHapusTerbuka(true)}
          disabled={!pengguna.bisaDihapus}
          aria-describedby={alasanTerkunci ? `hapus-alasan-${pengguna.id}` : undefined}
          className="w-full sm:w-auto"
        >
          <Trash2 />
          <span>Hapus akun</span>
        </Button>
        {alasanTerkunci ? (
          <p id={`hapus-alasan-${pengguna.id}`} className="text-base text-ink-muted">
            {alasanTerkunci}
          </p>
        ) : (
          <p className="text-base text-ink-muted">Hanya untuk akun yang salah dibuat dan belum punya transaksi.</p>
        )}
      </div>

      {hapusTerbuka && (
        <HapusAkunDialog
          pengguna={pengguna}
          onTutup={() => setHapusTerbuka(false)}
          onTerhapus={(pesan) => {
            setHapusTerbuka(false);
            onTerhapus(pesan);
          }}
        />
      )}
    </div>
  );
}
