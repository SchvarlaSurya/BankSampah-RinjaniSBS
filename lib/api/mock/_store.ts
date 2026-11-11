/**
 * lib/api/mock/_store.ts
 *
 * In-memory store untuk mock data — hanya dipakai saat development.
 * JANGAN diimpor dari luar folder mock/.
 *
 * Disimpan di globalThis: query (Server Component) dan action (Server Action) bisa dimuat
 * sebagai modul terpisah oleh Next.js, dan keduanya harus melihat data yang sama.
 * Sesi mock bersifat global untuk satu proses server (bukan per browser).
 */

import "server-only";
import type {
  UserId,
  IdStr,
  Rupiah,
  NasabahRingkas,
  PenggunaRingkas,
  JenisSampah,
  RiwayatHargaItem,
  TransaksiDetail,
  SesiInfo,
} from "@/contract";
import dataJenisSampah from "@/data/jenis-sampah-2026-09.json";

interface MockState {
  idSeq: number;
  sesi: SesiInfo | null;
  passwords: Map<UserId, string>;
  mustChangePassword: Map<UserId, boolean>;
  staf: PenggunaRingkas[];
  nasabah: NasabahRingkas[];
  usersByUsername: Map<string, NasabahRingkas | PenggunaRingkas>;
  usersById: Map<UserId, NasabahRingkas | PenggunaRingkas>;
  jenisSampah: JenisSampah[];
  riwayatHarga: RiwayatHargaItem[];
  /** Waktu akun dibuat (PenggunaDetail.createdAt). */
  dibuatPada: Map<UserId, string>;
  transaksi: TransaksiDetail[];
  /** clientRequestId -> transaksiId (idempotensi) */
  clientRequestIndex: Map<string, IdStr>;
  /** SHA-256 foto setor -> transaksiId (foto tidak boleh dipakai dua kali). */
  hashFoto: Map<string, IdStr>;
  /** Log audit hapus akun (seperti tabel audit_akun). */
  auditAkun: { pelakuId: UserId; targetUserId: UserId; targetUsername: string; alasan: string; waktu: string }[];
}

function buatState(): MockState {
  const staf: PenggunaRingkas[] = [
    {
      id: "user-sa-1" as UserId,
      username: "superadmin",
      nama: "Super Admin Rinjani",
      role: "super_admin",
      aktif: true,
    },
    {
      id: "user-admin-1" as UserId,
      username: "admin01",
      nama: "Admin Satu",
      role: "admin",
      aktif: true,
    },
  ];

  const nasabah: NasabahRingkas[] = [
    {
      id: "user-nasabah-1" as UserId,
      username: "0101",
      nama: "Budi Santoso",
      saldo: 50000 as Rupiah,
      aktif: true,
    },
    {
      id: "user-nasabah-2" as UserId,
      username: "0102",
      nama: "Siti Aminah",
      saldo: 120000 as Rupiah,
      aktif: true,
    },
  ];

  // Master jenis sampah dari Excel (sama dengan scripts/seed-jenis-sampah.ts: hanya satuan Kg).
  // Id = IdStr (angka sebagai string), sama seperti backend.
  const jenisSampah: JenisSampah[] = dataJenisSampah.jenisSampah
    .filter((x) => x.satuan === "Kg")
    .map((x, i) => ({
      id: String(i + 1) as IdStr,
      nama: x.nama,
      hargaBeli: x.hargaSbs as Rupiah,
      hargaJual: null,
      aktif: x.keterangan !== "Stop Sementara",
      terakhirDiubah: null,
    }));
  const js = (nama: string) => {
    const j = jenisSampah.find((x) => x.nama === nama);
    if (!j) throw new Error(`mock: jenis sampah "${nama}" tidak ada di data`);
    return { wasteTypeId: j.id, namaSampah: j.nama, hargaSnapshot: j.hargaBeli };
  };

  const transaksi: TransaksiDetail[] = [
    {
      id: "1001" as IdStr,
      tipe: "setor",
      jumlah: 16000 as Rupiah,
      catatan: null,
      waktu: "2024-09-01T08:00:00.000Z",
      dibuatOlehId: "user-admin-1" as UserId,
      dibuatOlehNama: "Admin Satu",
      customerId: "user-nasabah-1" as UserId,
      customerNama: "Budi Santoso",
      customerUsername: "0101",
      items: [
        { ...js("Kardus"), berat: "10.00", subtotal: 16000 as Rupiah },
      ],
      fotoUrl: "https://placehold.co/400x300/2d9e5f/ffffff?text=Foto+Timbangan",
      fotoUrlBerlakuHingga: "2026-12-31T23:59:59.000Z",
      sudahDibalik: false,
      membalikId: null,
      dibalikOlehId: null,
    },
    {
      id: "1002" as IdStr,
      tipe: "tarik",
      jumlah: -10000 as Rupiah,
      catatan: "Tarik tunai",
      waktu: "2024-09-10T09:30:00.000Z",
      dibuatOlehId: "user-admin-1" as UserId,
      dibuatOlehNama: "Admin Satu",
      customerId: "user-nasabah-1" as UserId,
      customerNama: "Budi Santoso",
      customerUsername: "0101",
      items: [],
      fotoUrl: null,
      fotoUrlBerlakuHingga: null,
      sudahDibalik: false,
      membalikId: null,
      dibalikOlehId: null,
    },
    {
      id: "1003" as IdStr,
      tipe: "setor",
      jumlah: 55650 as Rupiah,
      catatan: null,
      waktu: "2024-09-05T10:00:00.000Z",
      dibuatOlehId: "user-admin-1" as UserId,
      dibuatOlehNama: "Admin Satu",
      customerId: "user-nasabah-2" as UserId,
      customerNama: "Siti Aminah",
      customerUsername: "0102",
      items: [
        { ...js("Botol air mineral/bodong/pet bersih"), berat: "12.00", subtotal: 52800 as Rupiah },
        { ...js("Kaleng"), berat: "1.50", subtotal: 2850 as Rupiah },
      ],
      fotoUrl: "https://placehold.co/400x300/2d9e5f/ffffff?text=Timbangan+2",
      fotoUrlBerlakuHingga: "2026-12-31T23:59:59.000Z",
      sudahDibalik: false,
      membalikId: null,
      dibalikOlehId: null,
    },
  ];

  const semuaUser = [...staf, ...nasabah];
  return {
    // Di atas id transaksi contoh (1001..1003) supaya id baru tidak bentrok.
    idSeq: 2000,
    sesi: null,
    passwords: new Map(semuaUser.map((u) => [u.id, "password123"])),
    mustChangePassword: new Map(semuaUser.map((u) => [u.id, false])),
    staf,
    nasabah,
    usersByUsername: new Map(semuaUser.map((u) => [u.username, u])),
    usersById: new Map(semuaUser.map((u) => [u.id, u])),
    jenisSampah,
    riwayatHarga: [],
    dibuatPada: new Map(semuaUser.map((u) => [u.id, "2024-08-01T00:00:00.000Z"])),
    transaksi,
    clientRequestIndex: new Map(),
    hashFoto: new Map(),
    auditAkun: [],
  };
}

const g = globalThis as typeof globalThis & { __bankSampahMock?: MockState };
export const store: MockState = (g.__bankSampahMock ??= buatState());

/** Sama dengan punyaRiwayatSql di backend: transaksi (nasabah/petugas), riwayat harga, log audit. */
export function punyaRiwayat(id: UserId): boolean {
  return (
    store.transaksi.some((t) => t.customerId === id || t.dibuatOlehId === id) ||
    store.riwayatHarga.some((r) => r.diubahOlehId === id) ||
    store.auditAkun.some((a) => a.pelakuId === id)
  );
}

export const nextId = () => String(++store.idSeq) as IdStr;
export const nowIso = () => new Date().toISOString();
