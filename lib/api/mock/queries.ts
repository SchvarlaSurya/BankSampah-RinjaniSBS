/**
 * lib/api/mock/queries.ts
 *
 * Implementasi MOCK dari interface Queries (server-only, sama seperti implementasi asli).
 * Semua data berasal dari _store.ts (in-memory). Perilaku & kode error mengikuti backend
 * (server/api/queries.ts): guard yang sama, validasi zod kontrak yang sama.
 * Jangan diimpor langsung dari halaman UI — lewat saklar lib/api/queries.ts.
 */

import "server-only";
import { z } from "zod";
import {
  AuditInputSchema,
  CariNasabahInputSchema,
  fail,
  failDariZod,
  GetNasabahInputSchema,
  GetTransaksiInputSchema,
  HistoriInputSchema,
  ListPenggunaInputSchema,
  ok,
  RiwayatHargaInputSchema,
  type JenisSampah,
  type PenggunaDetail,
  type Queries,
  type TransaksiDetail,
  type TransaksiRingkas,
} from "@/contract";
import { guard } from "./_guard";
import { punyaRiwayat, store } from "./_store";
import { computeStreak } from "@/lib/streak";

/** Delay palsu agar terasa realistis (50ms). */
const delay = () => new Promise<void>((r) => setTimeout(r, 50));

const ListJenisSampahInputSchema = z.object({ termasukNonaktif: z.boolean().optional() }).optional();

/** Urut id DESC (id = angka sebagai string), sama dengan backend. */
const idTurun = (a: { id: string }, b: { id: string }) => Number(b.id) - Number(a.id);

/** Halaman cursor: item dengan id < cursor, ambil limit, nextCursor = id terakhir bila masih ada. */
function halaman<T extends { id: string }>(semua: T[], cursor: string | undefined, limit: number) {
  const sisa = cursor ? semua.filter((t) => Number(t.id) < Number(cursor)) : semua;
  const items = sisa.slice(0, limit);
  return { items, nextCursor: sisa.length > limit ? items[items.length - 1].id : null };
}

/** Tanggal kalender Asia/Jakarta (UTC+7, tanpa DST) dari IsoUtc. */
const tanggalWib = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10);

/** "2026-02-30" lolos regex tapi bukan tanggal: backend menolak dengan "Tanggal tidak valid". */
const tanggalAda = (t: string) => {
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
};

function ringkas(t: TransaksiDetail): TransaksiRingkas {
  return {
    id: t.id,
    tipe: t.tipe,
    jumlah: t.jumlah,
    waktu: t.waktu,
    catatan: t.catatan,
    dibuatOlehNama: t.dibuatOlehNama,
    sudahDibalik: t.sudahDibalik,
    membalikId: t.membalikId,
  };
}

/** fotoUrl hanya untuk super_admin. */
function tampil(t: TransaksiDetail, superAdmin: boolean): TransaksiDetail {
  return superAdmin ? t : { ...t, fotoUrl: null, fotoUrlBerlakuHingga: null };
}

export const mockQueries: Queries = {
  async getSesi() {
    await delay();
    const g = guard("getSesi");
    return g.ok ? { ...g.sesi, fotoVersi: store.fotoProfil.get(g.sesi.userId) ?? null } : null;
  },

  async getProfilSaya() {
    await delay();
    const g = guard("getProfilSaya");
    if (!g.ok) return g.hasil;
    const profil = store.nasabah.find((n) => n.id === g.sesi.userId);
    if (!profil) return fail("NASABAH_TIDAK_DITEMUKAN");
    return ok(profil);
  },

  async cariNasabah(input) {
    await delay();
    const g = guard("cariNasabah");
    if (!g.ok) return g.hasil;
    const parsed = CariNasabahInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const q = parsed.data.query.toLowerCase();
    const hasil = store.nasabah
      .filter((n) => n.username.toLowerCase().startsWith(q) || n.nama.toLowerCase().startsWith(q))
      .sort((a, b) => a.username.localeCompare(b.username))
      .slice(0, 20);
    return ok(hasil);
  },

  async getNasabah(input) {
    await delay();
    const g = guard("getNasabah");
    if (!g.ok) return g.hasil;
    const parsed = GetNasabahInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const nasabah = store.nasabah.find((n) => n.id === parsed.data.customerId);
    if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");
    return ok(nasabah);
  },

  async listJenisSampah(input) {
    await delay();
    const g = guard("listJenisSampah");
    if (!g.ok) return g.hasil;
    const parsed = ListJenisSampahInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const staf = g.sesi.role !== "nasabah";
    const semua = staf && parsed.data?.termasukNonaktif === true;
    const hasil = (semua ? store.jenisSampah : store.jenisSampah.filter((j) => j.aktif))
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
    const g = guard("listRiwayatHarga");
    if (!g.ok) return g.hasil;
    const parsed = RiwayatHargaInputSchema.safeParse(input ?? {});
    if (!parsed.success) return failDariZod(parsed.error);
    const hasil = store.riwayatHarga
      .filter((r) => !parsed.data.sampahId || r.sampahId === parsed.data.sampahId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok(hasil);
  },

  async listStaf() {
    await delay();
    const g = guard("listStaf");
    if (!g.ok) return g.hasil;
    return ok([...store.staf].sort((a, b) => a.role.localeCompare(b.role) || a.username.localeCompare(b.username)));
  },

  async listPengguna(input) {
    await delay();
    const g = guard("listPengguna");
    if (!g.ok) return g.hasil;
    const parsed = ListPenggunaInputSchema.safeParse(input ?? {});
    if (!parsed.success) return failDariZod(parsed.error);
    const { search, rt, aktif, limit, offset } = parsed.data;
    // Admin hanya boleh melihat nasabah, apa pun filter role yang dikirim.
    const role = g.sesi.role === "admin" ? "nasabah" : parsed.data.role;
    const q = search?.toLowerCase();
    const prefixRt = rt?.padStart(2, "0");
    const semua: PenggunaDetail[] = [
      ...store.staf,
      ...store.nasabah.map((n) => ({ id: n.id, username: n.username, nama: n.nama, role: "nasabah" as const, aktif: n.aktif })),
    ]
      .filter((u) => !role || u.role === role)
      .filter((u) => aktif === undefined || u.aktif === aktif)
      .filter((u) => !prefixRt || u.username.startsWith(prefixRt))
      .filter((u) => !q || u.username.toLowerCase().includes(q) || u.nama.toLowerCase().includes(q))
      .sort((a, b) => a.role.localeCompare(b.role) || a.username.localeCompare(b.username))
      .map((u) => {
        const superAdminLain = store.staf.filter((s) => s.role === "super_admin" && s.aktif && s.id !== u.id).length;
        const alasan =
          g.sesi.role !== "super_admin"
            ? ("TIDAK_DIIZINKAN" as const)
            : u.id === g.sesi.userId
              ? ("TIDAK_BISA_HAPUS_DIRI" as const)
              : u.role === "super_admin" && superAdminLain < 1
                ? ("SUPER_ADMIN_TERAKHIR" as const)
                : punyaRiwayat(u.id)
                  ? ("AKUN_PUNYA_RIWAYAT" as const)
                  : null;
        return {
          ...u,
          rt: u.role === "nasabah" && /^\d{2}/.test(u.username) ? u.username.slice(0, 2) : null,
          mustChangePassword: store.mustChangePassword.get(u.id) ?? false,
          createdAt: store.dibuatPada.get(u.id) ?? "2024-08-01T00:00:00.000Z",
          bisaDihapus: alasan === null,
          alasanTidakBisaDihapus: alasan,
          fotoVersi: store.fotoProfil.get(u.id) ?? null,
        };
      });
    return ok({ items: semua.slice(offset, offset + limit), total: semua.length, limit, offset });
  },

  async getHistori(input) {
    await delay();
    const g = guard("getHistori");
    if (!g.ok) return g.hasil;
    const parsed = HistoriInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    // Nasabah selalu dipaksa ke dirinya sendiri (bukan ditolak), sama dengan backend.
    const customerId = g.sesi.role === "nasabah" ? g.sesi.userId : parsed.data.customerId;
    if (!store.nasabah.some((n) => n.id === customerId)) return fail("NASABAH_TIDAK_DITEMUKAN");
    const semua = store.transaksi.filter((t) => t.customerId === customerId).sort(idTurun).map(ringkas);
    return ok(halaman(semua, parsed.data.cursor, parsed.data.limit));
  },

  async getTransaksi(input) {
    await delay();
    const g = guard("getTransaksi");
    if (!g.ok) return g.hasil;
    const parsed = GetTransaksiInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const transaksi = store.transaksi.find((t) => t.id === parsed.data.id);
    // Transaksi nasabah lain tidak dibedakan dari yang tidak ada.
    if (!transaksi || (g.sesi.role === "nasabah" && transaksi.customerId !== g.sesi.userId)) {
      return fail("TRANSAKSI_TIDAK_DITEMUKAN");
    }
    return ok(tampil(transaksi, g.sesi.role === "super_admin"));
  },

  async auditTransaksi(input) {
    await delay();
    const g = guard("auditTransaksi");
    if (!g.ok) return g.hasil;
    const parsed = AuditInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const { adminId, tipe, dari, sampai, cursor, limit } = parsed.data;
    const salah: Record<string, string[]> = {};
    if (dari && !tanggalAda(dari)) salah.dari = ["Tanggal tidak valid"];
    if (sampai && !tanggalAda(sampai)) salah.sampai = ["Tanggal tidak valid"];
    if (Object.keys(salah).length > 0) return fail("VALIDASI_GAGAL", { fieldErrors: salah });

    const semua = store.transaksi
      .filter((t) => !adminId || t.dibuatOlehId === adminId)
      .filter((t) => !tipe || t.tipe === tipe)
      .filter((t) => !dari || tanggalWib(t.waktu) >= dari)
      .filter((t) => !sampai || tanggalWib(t.waktu) <= sampai)
      .sort(idTurun)
      .map((t) => tampil(t, true));
    return ok(halaman(semua, cursor, limit));
  },

  async getAktivitasAdmin() {
    await delay();
    const g = guard("getAktivitasAdmin");
    if (!g.ok) return g.hasil;
    // Mock: tiap staf dianggap masuk hari ini saja; streak orang lain hanya untuk super_admin.
    const sekarang = new Date();
    const hariIni = tanggalWib(sekarang.toISOString());
    const streakSaya = computeStreak([hariIni], hariIni);
    const superAdmin = g.sesi.role === "super_admin";
    return ok({
      serverNow: sekarang.toISOString(),
      hariIni,
      saya: streakSaya,
      tim: store.staf
        .filter((s) => s.aktif)
        .map((s) => ({
          id: s.id,
          nama: s.nama,
          username: s.username,
          role: s.role === "super_admin" ? ("super_admin" as const) : ("admin" as const),
          online: s.id === g.sesi.userId,
          lastSeenAt: s.id === g.sesi.userId ? sekarang.toISOString() : null,
          fotoVersi: store.fotoProfil.get(s.id) ?? null,
          streak: superAdmin || s.id === g.sesi.userId ? computeStreak([hariIni], hariIni) : null,
        })),
    });
  },
};
