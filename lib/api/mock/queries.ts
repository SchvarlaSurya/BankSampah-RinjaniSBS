/**
 * lib/api/mock/queries.ts
 *
 * Implementasi MOCK dari interface Queries (server-only, sama seperti implementasi asli).
 * Semua data berasal dari _store.ts (in-memory).
 * Jangan diimpor langsung dari halaman UI — lewat saklar lib/api/queries.ts.
 */

import "server-only";
import type { JenisSampah, PenggunaDetail, Queries, TransaksiRingkas } from "@/contract";
import { ok, fail } from "@/contract";
import { store } from "./_store";

/** Delay palsu agar terasa realistis (50ms). */
const delay = () => new Promise<void>((r) => setTimeout(r, 50));

export const mockQueries: Queries = {
  async getSesi() {
    await delay();
    return store.sesi;
  },

  async getProfilSaya() {
    await delay();
    const sesi = store.sesi;
    if (!sesi) return fail("TIDAK_LOGIN");
    if (sesi.role !== "nasabah") return fail("TIDAK_DIIZINKAN");
    const profil = store.nasabah.find((n) => n.id === sesi.userId);
    if (!profil) return fail("NASABAH_TIDAK_DITEMUKAN");
    return ok(profil);
  },

  async cariNasabah({ query }) {
    await delay();
    const sesi = store.sesi;
    if (!sesi) return fail("TIDAK_LOGIN");
    if (sesi.role === "nasabah") return fail("TIDAK_DIIZINKAN");
    const q = query.toLowerCase();
    const hasil = store.nasabah
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
    const sesi = store.sesi;
    if (!sesi) return fail("TIDAK_LOGIN");
    if (sesi.role === "nasabah" && sesi.userId !== customerId) {
      return fail("TIDAK_DIIZINKAN");
    }
    const nasabah = store.nasabah.find((n) => n.id === customerId);
    if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");
    return ok(nasabah);
  },

  async listJenisSampah(input) {
    await delay();
    const sesi = store.sesi;
    if (!sesi) return fail("TIDAK_LOGIN");
    const staf = sesi.role !== "nasabah";
    const termasukNonaktif = staf && (input?.termasukNonaktif ?? false);
    const hasil = (termasukNonaktif ? store.jenisSampah : store.jenisSampah.filter((j) => j.aktif))
      .map((j): JenisSampah => {
        if (staf) return j;
        const { hargaJual: _hargaJual, ...tanpaHargaJual } = j;
        void _hargaJual;
        return tanpaHargaJual;
      })
      .sort((a, b) => a.nama.localeCompare(b.nama));
    return ok(hasil);
  },

  async listRiwayatHarga(input) {
    await delay();
    const sesi = store.sesi;
    if (!sesi) return fail("TIDAK_LOGIN");
    if (sesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");
    const hasil = store.riwayatHarga
      .filter((r) => !input?.sampahId || r.sampahId === input.sampahId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok(hasil);
  },

  async listPengguna(input) {
    await delay();
    const sesi = store.sesi;
    if (!sesi) return fail("TIDAK_LOGIN");
    if (sesi.role === "nasabah") return fail("TIDAK_DIIZINKAN");
    const role = sesi.role === "admin" ? "nasabah" : input?.role;
    const q = input?.search?.trim().toLowerCase();
    const rt = input?.rt?.trim().padStart(2, "0");
    const limit = input?.limit ?? 20;
    const offset = input?.offset ?? 0;
    const semua: PenggunaDetail[] = [
      ...store.staf,
      ...store.nasabah.map((n) => ({ id: n.id, username: n.username, nama: n.nama, role: "nasabah" as const, aktif: n.aktif })),
    ]
      .filter((u) => !role || u.role === role)
      .filter((u) => input?.aktif === undefined || u.aktif === input.aktif)
      .filter((u) => !rt || u.username.startsWith(rt))
      .filter((u) => !q || u.username.toLowerCase().includes(q) || u.nama.toLowerCase().includes(q))
      .sort((a, b) => a.role.localeCompare(b.role) || a.username.localeCompare(b.username))
      .map((u) => ({
        ...u,
        rt: u.role === "nasabah" && /^\d{2}/.test(u.username) ? u.username.slice(0, 2) : null,
        mustChangePassword: store.mustChangePassword.get(u.id) ?? false,
        createdAt: store.dibuatPada.get(u.id) ?? "2024-08-01T00:00:00.000Z",
      }));
    return ok({ items: semua.slice(offset, offset + limit), total: semua.length, limit, offset });
  },

  async listStaf() {
    await delay();
    const sesi = store.sesi;
    if (!sesi) return fail("TIDAK_LOGIN");
    if (sesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");
    return ok(store.staf);
  },

  async getHistori({ customerId, cursor, limit = 20 }) {
    await delay();
    const sesi = store.sesi;
    if (!sesi) return fail("TIDAK_LOGIN");
    if (sesi.role === "nasabah" && sesi.userId !== customerId) {
      return fail("TIDAK_DIIZINKAN");
    }
    const nasabah = store.usersById.get(customerId);
    if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");

    const semua = store.transaksi
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
    const sesi = store.sesi;
    if (!sesi) return fail("TIDAK_LOGIN");
    const transaksi = store.transaksi.find((t) => t.id === id);
    if (!transaksi) return fail("TRANSAKSI_TIDAK_DITEMUKAN");
    if (sesi.role === "nasabah" && transaksi.customerId !== sesi.userId) {
      return fail("TIDAK_DIIZINKAN");
    }

    // Hide fotoUrl if not super_admin
    const detail: typeof transaksi = {
      ...transaksi,
      fotoUrl: sesi.role === "super_admin" ? transaksi.fotoUrl : null,
      fotoUrlBerlakuHingga: sesi.role === "super_admin" ? transaksi.fotoUrlBerlakuHingga : null,
    };

    return ok(detail);
  },

  async auditTransaksi(input) {
    await delay();
    const sesi = store.sesi;
    if (!sesi) return fail("TIDAK_LOGIN");
    if (sesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

    let semua = [...store.transaksi].sort((a, b) =>
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
};
