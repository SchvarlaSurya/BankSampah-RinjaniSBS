/**
 * src/lib/api/mock/_store.ts
 *
 * In-memory store untuk mock data — hanya dipakai saat development.
 * JANGAN diimpor dari luar folder mock/.
 */

import type {
  UserId,
  IdStr,
  Rupiah,
  NasabahRingkas,
  PenggunaRingkas,
  JenisSampah,
  TransaksiDetail,
  SesiInfo,
} from "@/src/contract";

// ── Helpers ──────────────────────────────────────────────────────────────────

let _idSeq = 1000;
export const nextId = () => String(++_idSeq) as IdStr;

export const nowIso = () => new Date().toISOString();

// ── Sesi aktif ───────────────────────────────────────────────────────────────

export let activeSesi: SesiInfo | null = null;
export function setActiveSesi(s: SesiInfo | null) {
  activeSesi = s;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export const mockPasswords: Map<UserId, string> = new Map([
  ["user-sa-1" as UserId, "password123"],
  ["user-admin-1" as UserId, "password123"],
  ["user-nasabah-1" as UserId, "password123"],
  ["user-nasabah-2" as UserId, "password123"],
]);

export const mockMustChangePassword: Map<UserId, boolean> = new Map([
  ["user-sa-1" as UserId, false],
  ["user-admin-1" as UserId, false],
  ["user-nasabah-1" as UserId, false],
  ["user-nasabah-2" as UserId, false],
]);

export const mockStaf: PenggunaRingkas[] = [
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

export const mockNasabah: NasabahRingkas[] = [
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

// Lookup map username -> user info (staf + nasabah)
export const allUsersByUsername = new Map<string, NasabahRingkas | PenggunaRingkas>([
  ["superadmin", mockStaf[0]],
  ["admin01", mockStaf[1]],
  ["nasabah01", mockNasabah[0]],
  ["nasabah02", mockNasabah[1]],
]);

export const allUsersById = new Map<UserId, NasabahRingkas | PenggunaRingkas>([
  ["user-sa-1" as UserId, mockStaf[0]],
  ["user-admin-1" as UserId, mockStaf[1]],
  ["user-nasabah-1" as UserId, mockNasabah[0]],
  ["user-nasabah-2" as UserId, mockNasabah[1]],
]);

// ── Jenis Sampah ──────────────────────────────────────────────────────────────

export const mockJenisSampah: JenisSampah[] = [
  { id: "js-1" as IdStr, nama: "Kertas / Kardus", hargaBeli: 1500 as Rupiah, aktif: true },
  { id: "js-2" as IdStr, nama: "Plastik PET (Botol)", hargaBeli: 2500 as Rupiah, aktif: true },
  { id: "js-3" as IdStr, nama: "Aluminium / Kaleng", hargaBeli: 8000 as Rupiah, aktif: true },
  { id: "js-4" as IdStr, nama: "Besi / Logam", hargaBeli: 3000 as Rupiah, aktif: true },
  { id: "js-5" as IdStr, nama: "Kaca / Botol Kaca", hargaBeli: 500 as Rupiah, aktif: false },
];

// ── Transaksi ─────────────────────────────────────────────────────────────────

export const mockTransaksi: TransaksiDetail[] = [
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
        wasteTypeId: "js-1" as IdStr,
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
        wasteTypeId: "js-2" as IdStr,
        namaSampah: "Plastik PET (Botol)",
        berat: "12.00",
        hargaSnapshot: 2500 as Rupiah,
        subtotal: 30000 as Rupiah,
      },
      {
        wasteTypeId: "js-3" as IdStr,
        namaSampah: "Aluminium / Kaleng",
        berat: "01.50",
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

// ── Lookup: clientRequestId -> transaksiId (untuk idempotensi) ────────────────

export const clientRequestIndex: Map<string, IdStr> = new Map();
