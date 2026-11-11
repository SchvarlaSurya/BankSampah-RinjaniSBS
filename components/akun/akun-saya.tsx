import type { SesiInfo } from "@/contract";
import { GantiPasswordModal } from "@/app/nasabah/GantiPasswordModal";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FotoProfilEditor } from "./foto-profil-editor";

const NAMA_PERAN = { super_admin: "Super Admin", admin: "Admin", nasabah: "Nasabah" } as const;

/** Halaman "Akun Saya" (semua role): data akun, foto profil, ganti password. */
export function AkunSaya({ sesi }: { sesi: SesiInfo }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader title="Foto profil" description="Foto ini tampil di menu dan daftar pengguna." />
        <CardBody>
          <FotoProfilEditor userId={sesi.userId} nama={sesi.nama} fotoVersi={sesi.fotoVersi} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Data akun" />
        <dl className="divide-y divide-line text-base">
          <div className="flex justify-between gap-4 px-5 py-3.5">
            <dt className="text-ink-muted">Nama</dt>
            <dd className="min-w-0 text-right font-medium break-words text-ink">{sesi.nama}</dd>
          </div>
          <div className="flex justify-between gap-4 px-5 py-3.5">
            <dt className="text-ink-muted">ID</dt>
            <dd className="font-semibold text-ink tabular-nums slashed-zero">{sesi.username}</dd>
          </div>
          <div className="flex justify-between gap-4 px-5 py-3.5">
            <dt className="text-ink-muted">Peran</dt>
            <dd className="font-medium text-ink">{NAMA_PERAN[sesi.role]}</dd>
          </div>
        </dl>
        <div className="border-t border-line p-5">
          <GantiPasswordModal />
        </div>
      </Card>
    </div>
  );
}
