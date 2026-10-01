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
  TransaksiDetail,
  SesiInfo,
} from "@/contract";

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
  transaksi: TransaksiDetail[];
  /** clientRequestId -> transaksiId (idempotensi) */
  clientRequestIndex: Map<string, IdStr>;
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
      username: "nasabah01",
      nama: "Budi Santoso",
      saldo: 50000 as Rupiah,
      aktif: true,
    },
    {
      id: "user-nasabah-2" as UserId,
      username: "nasabah02",
      nama: "Siti Aminah",
      saldo: 120000 as Rupiah,
      aktif: true,
    },
  ];

  // Id jenis sampah & transaksi = IdStr (angka sebagai string), sama seperti backend.
  const jenisSampah: JenisSampah[] = [
    { id: "1" as IdStr, nama: "Kertas / Kardus", hargaBeli: 1500 as Rupiah, aktif: true },
    { id: "2" as IdStr, nama: "Plastik PET (Botol)", hargaBeli: 2500 as Rupiah, aktif: true },
    { id: "3" as IdStr, nama: "Aluminium / Kaleng", hargaBeli: 8000 as Rupiah, aktif: true },
    { id: "4" as IdStr, nama: "Besi / Logam", hargaBeli: 3000 as Rupiah, aktif: true },
    { id: "5" as IdStr, nama: "Kaca / Botol Kaca", hargaBeli: 500 as Rupiah, aktif: false },
  ];

  const transaksi: TransaksiDetail[] = [
    {
      id: "1001" as IdStr,
      tipe: "setor",
      jumlah: 15000 as Rupiah,
      catatan: null,
      waktu: "2024-09-01T08:00:00.000Z",
      dibuatOlehId: "user-admin-1" as UserId,
      dibuatOlehNama: "Admin Satu",
      customerId: "user-nasabah-1" as UserId,
      customerNama: "Budi Santoso",
      customerUsername: "nasabah01",
      items: [
        {
          wasteTypeId: "1" as IdStr,
          namaSampah: "Kertas / Kardus",
          berat: "10.00",
          hargaSnapshot: 1500 as Rupiah,
          subtotal: 15000 as Rupiah,
        },
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
      customerUsername: "nasabah01",
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
      jumlah: 45000 as Rupiah,
      catatan: null,
      waktu: "2024-09-05T10:00:00.000Z",
      dibuatOlehId: "user-admin-1" as UserId,
      dibuatOlehNama: "Admin Satu",
      customerId: "user-nasabah-2" as UserId,
      customerNama: "Siti Aminah",
      customerUsername: "nasabah02",
      items: [
        {
          wasteTypeId: "2" as IdStr,
          namaSampah: "Plastik PET (Botol)",
          berat: "12.00",
          hargaSnapshot: 2500 as Rupiah,
          subtotal: 30000 as Rupiah,
        },
        {
          wasteTypeId: "3" as IdStr,
          namaSampah: "Aluminium / Kaleng",
          berat: "1.50",
          hargaSnapshot: 8000 as Rupiah,
          subtotal: 12000 as Rupiah,
        },
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
    transaksi,
    clientRequestIndex: new Map(),
  };
}

const g = globalThis as typeof globalThis & { __bankSampahMock?: MockState };
export const store: MockState = (g.__bankSampahMock ??= buatState());

export const nextId = () => String(++store.idSeq) as IdStr;
export const nowIso = () => new Date().toISOString();
