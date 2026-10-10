/**
 * src/lib/api/mock/queries.ts
 *
 * Implementasi MOCK dari interface Queries.
 * Semua data berasal dari _store.ts (in-memory).
 * Hanya dipakai di development — jangan diimpor langsung dari halaman UI.
 * Import lewat saklar: src/lib/api/queries.ts
 */

import type { Queries, TransaksiRingkas, JenisSampah } from "@/src/contract";
import { ok, fail } from "@/src/contract";
import {
  activeSesi,
  mockNasabah,
  mockStaf,
  mockJenisSampah,
  mockRiwayatHarga,
  mockTransaksi,
  allUsersById,
} from "./_store";

/** Delay palsu agar terasa realistis (50ms). */
const delay = () => new Promise<void>((r) => setTimeout(r, 50));

export const mockQueries: Queries = {
  async getSesi() {
    await delay();
    return activeSesi;
  },

  async getProfilSaya() {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role !== "nasabah") return fail("TIDAK_DIIZINKAN");
    const profil = mockNasabah.find((n) => n.id === activeSesi!.userId);
    if (!profil) return fail("NASABAH_TIDAK_DITEMUKAN");
    return ok(profil);
  },

  async cariNasabah({ query }) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role === "nasabah") return fail("TIDAK_DIIZINKAN");
    const q = query.toLowerCase();
    const hasil = mockNasabah
      .filter(
        (n) =>
          n.username.toLowerCase().startsWith(q) ||
          n.nama.toLowerCase().startsWith(q)
      )
      .slice(0, 20);
    return ok(hasil);
  },

  async getNasabah({ customerId }) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role === "nasabah" && activeSesi.userId !== customerId) {
      return fail("TIDAK_DIIZINKAN");
    }
    const nasabah = mockNasabah.find((n) => n.id === customerId);
    if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");
    return ok(nasabah);
  },

  async listJenisSampah(input) {
    await delay();
    const isAdmin = activeSesi?.role === "admin" || activeSesi?.role === "super_admin";
    const termasukNonaktif = isAdmin ? (input?.termasukNonaktif ?? false) : false;
    const rows = termasukNonaktif
      ? mockJenisSampah
      : mockJenisSampah.filter((j) => j.aktif);

    const hasil: JenisSampah[] = rows.map((j) => {
      const item: JenisSampah = {
        id: j.id,
        nama: j.nama,
        hargaBeli: j.hargaBeli,
        aktif: j.aktif,
        terakhirDiubah: j.terakhirDiubah,
      };
      if (isAdmin) {
        item.hargaJual = j.hargaJual ?? Math.round(j.hargaBeli * 1.2);
      }
      return item;
    });
    return ok(hasil);
  },

  async listRiwayatHarga(input) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

    let hasil = [...mockRiwayatHarga];
    if (input?.sampahId) {
      hasil = hasil.filter((r) => r.sampahId === input.sampahId);
    }
    return ok(hasil);
  },

  async listStaf() {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");
    return ok(mockStaf);
  },

  async getHistori({ customerId, cursor, limit = 20 }) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role === "nasabah" && activeSesi.userId !== customerId) {
      return fail("TIDAK_DIIZINKAN");
    }
    const nasabah = allUsersById.get(customerId);
    if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");

    const semua = mockTransaksi
      .filter((t) => t.customerId === customerId)
      .sort((a, b) => b.waktu.localeCompare(a.waktu));

    const startIdx = cursor ? semua.findIndex((t) => t.id === cursor) + 1 : 0;
    const slice = semua.slice(startIdx, startIdx + limit);
    const nextCursor =
      startIdx + limit < semua.length ? semua[startIdx + limit - 1].id : null;

    const ringkasItems: TransaksiRingkas[] = slice.map((t) => ({
      id: t.id,
      tipe: t.tipe,
      jumlah: t.jumlah,
      waktu: t.waktu,
      catatan: t.catatan,
      dibuatOlehNama: t.dibuatOlehNama,
      sudahDibalik: t.sudahDibalik,
      membalikId: t.membalikId,
    }));

    return ok({
      items: ringkasItems,
      nextCursor,
    });
  },

  async getTransaksi({ id }) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    const transaksi = mockTransaksi.find((t) => t.id === id);
    if (!transaksi) return fail("TRANSAKSI_TIDAK_DITEMUKAN");
    if (
      activeSesi.role === "nasabah" &&
      transaksi.customerId !== activeSesi.userId
    ) {
      return fail("TIDAK_DIIZINKAN");
    }

    // Hide fotoUrl if not super_admin
    const detail: typeof transaksi = {
      ...transaksi,
      fotoUrl: activeSesi.role === "super_admin" ? transaksi.fotoUrl : null,
      fotoUrlBerlakuHingga: activeSesi.role === "super_admin" ? transaksi.fotoUrlBerlakuHingga : null,
    };

    return ok(detail);
  },

  async auditTransaksi(input) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

    let semua = [...mockTransaksi].sort((a, b) =>
      b.waktu.localeCompare(a.waktu)
    );

    if (input?.tipe) semua = semua.filter((t) => t.tipe === input.tipe);
    if (input?.dari)
      semua = semua.filter((t) => t.waktu.slice(0, 10) >= input.dari!);
    if (input?.sampai)
      semua = semua.filter((t) => t.waktu.slice(0, 10) <= input.sampai!);

    const limit = input?.limit ?? 20;
    const startIdx = input?.cursor
      ? semua.findIndex((t) => t.id === input.cursor) + 1
      : 0;
    const slice = semua.slice(startIdx, startIdx + limit);
    const nextCursor =
      startIdx + limit < semua.length ? semua[startIdx + limit - 1].id : null;

    return ok({
      items: slice,
      nextCursor,
    });
  },

  async listPengguna(input) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role !== "super_admin" && activeSesi.role !== "admin") return fail("TIDAK_DIIZINKAN");

    // Gather all users from mockStaf + mockNasabah
    let allUsers: Array<{
      id: any;
      username: string;
      nama: string;
      role: "super_admin" | "admin" | "nasabah";
      aktif: boolean;
      rt: string | null;
      mustChangePassword: boolean;
      createdAt: string;
    }> = [
      ...mockStaf.map((s) => ({
        id: s.id,
        username: s.username,
        nama: s.nama,
        role: s.role,
        aktif: s.aktif,
        rt: null,
        mustChangePassword: false,
        createdAt: new Date().toISOString(),
      })),
      ...mockNasabah.map((n) => ({
        id: n.id,
        username: n.username,
        nama: n.nama,
        role: "nasabah" as const,
        aktif: n.aktif,
        rt: /^\d{2}/.test(n.username) ? n.username.slice(0, 2) : null,
        mustChangePassword: false,
        createdAt: new Date().toISOString(),
      })),
    ];

    // Admin basic enforcement
    let roleFilter = input?.role;
    if (activeSesi.role === "admin") {
      roleFilter = "nasabah";
    }

    if (roleFilter) {
      allUsers = allUsers.filter((u) => u.role === roleFilter);
    } else if (activeSesi.role === "admin") {
      allUsers = allUsers.filter((u) => u.role === "nasabah");
    }

    if (input?.aktif !== undefined) {
      allUsers = allUsers.filter((u) => u.aktif === input.aktif);
    }

    if (input?.rt) {
      const rtClean = input.rt.padStart(2, "0");
      allUsers = allUsers.filter((u) => u.username.startsWith(rtClean));
    }

    if (input?.search) {
      const q = input.search.toLowerCase();
      allUsers = allUsers.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.nama.toLowerCase().includes(q)
      );
    }

    const limit = input?.limit ?? 20;
    const offset = input?.offset ?? 0;
    const total = allUsers.length;
    const items = allUsers.slice(offset, offset + limit);

    return ok({
      items,
      total,
      limit,
      offset,
    });
  },
};
