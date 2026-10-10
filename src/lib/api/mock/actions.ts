/**
 * src/lib/api/mock/actions.ts
 *
 * Implementasi MOCK dari interface Actions.
 * Semua perubahan disimpan ke _store.ts (in-memory, hilang saat restart).
 * Hanya dipakai di development — jangan diimpor langsung dari halaman UI.
 * Import lewat saklar: src/lib/api/actions.ts
 */

import type {
  Actions,
  TransaksiDetail,
  JenisSampah,
  NasabahRingkas,
  PenggunaRingkas,
  Role,
  UserId,
  IdStr,
  Rupiah,
} from "@/src/contract";
import {
  ok,
  fail,
  failDariZod,
  normalisasiBerat,
  estimasiSubtotal,
  parseSetorFormData,
  LoginInputSchema,
  GantiPasswordInputSchema,
  BuatPenggunaInputSchema,
  ResetPasswordInputSchema,
  SetStatusPenggunaInputSchema,
  SimpanJenisSampahInputSchema,
  SetorInputSchema,
  TarikInputSchema,
  KoreksiInputSchema,
} from "@/src/contract";
import {
  activeSesi,
  setActiveSesi,
  mockPasswords,
  mockMustChangePassword,
  mockStaf,
  mockNasabah,
  mockJenisSampah,
  mockTransaksi,
  clientRequestIndex,
  allUsersByUsername,
  allUsersById,
  nextId,
  nowIso,
} from "./_store";

/** Delay palsu (50ms). */
const delay = () => new Promise<void>((r) => setTimeout(r, 50));

/** Generate password sementara 8 karakter alfanumerik. */
function genPassword(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

export const mockActions: Actions = {
  // ── Auth ──────────────────────────────────────────────────────────────────

  async login(input) {
    await delay();
    const parsed = LoginInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);

    const user = allUsersByUsername.get(parsed.data.username.toLowerCase());
    if (!user) return fail("KREDENSIAL_SALAH");

    const stored = mockPasswords.get(user.id as UserId);
    if (stored !== parsed.data.password) return fail("KREDENSIAL_SALAH");

    const nasabah = mockNasabah.find((n) => n.id === user.id);
    const staf = mockStaf.find((s) => s.id === user.id);
    const aktif = nasabah?.aktif ?? staf?.aktif ?? false;
    if (!aktif) return fail("TIDAK_DIIZINKAN");

    const role: Role = staf?.role ?? "nasabah";
    const mustChange = mockMustChangePassword.get(user.id as UserId) ?? false;
    const sesi = {
      userId: user.id as UserId,
      username: user.username,
      nama: user.nama,
      role,
      mustChangePassword: mustChange,
    };
    setActiveSesi(sesi);
    return ok(sesi);
  },

  async logout() {
    await delay();
    setActiveSesi(null);
    return ok(null);
  },

  async gantiPassword(input) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    const parsed = GantiPasswordInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);

    const stored = mockPasswords.get(activeSesi.userId);
    if (stored !== parsed.data.passwordLama) {
      return fail("PASSWORD_LAMA_SALAH");
    }

    mockPasswords.set(activeSesi.userId, parsed.data.passwordBaru);
    mockMustChangePassword.set(activeSesi.userId, false);
    setActiveSesi({ ...activeSesi, mustChangePassword: false });
    return ok(null);
  },

  // ── Manajemen Pengguna (SA) ───────────────────────────────────────────────

  async buatPengguna(input) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role !== "super_admin" && (activeSesi.role !== "admin" || input.role !== "nasabah")) {
      return fail("TIDAK_DIIZINKAN");
    }

    const parsed = BuatPenggunaInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);

    if (allUsersByUsername.has(parsed.data.username)) {
      return fail("USERNAME_SUDAH_ADA");
    }

    const userId = `user-${Date.now()}` as UserId;
    const passwordSementara = parsed.data.role === "nasabah" ? parsed.data.username : genPassword();

    mockPasswords.set(userId, passwordSementara);
    mockMustChangePassword.set(userId, true);

    const pengguna: PenggunaRingkas = {
      id: userId,
      username: parsed.data.username,
      nama: parsed.data.nama,
      role: parsed.data.role,
      aktif: true,
    };

    if (parsed.data.role === "nasabah") {
      const newNasabah: NasabahRingkas = {
        id: userId,
        username: parsed.data.username,
        nama: parsed.data.nama,
        saldo: 0 as Rupiah,
        aktif: true,
      };
      mockNasabah.push(newNasabah);
      allUsersByUsername.set(parsed.data.username, newNasabah);
      allUsersById.set(userId, newNasabah);
    } else {
      mockStaf.push(pengguna);
      allUsersByUsername.set(parsed.data.username, pengguna);
      allUsersById.set(userId, pengguna);
    }

    return ok({ pengguna, passwordSementara });
  },

  async getLatestIdByRt(input) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role !== "super_admin" && activeSesi.role !== "admin") return fail("TIDAK_DIIZINKAN");

    const rawRt = input.rtNumber.replace(/\D/g, "");
    const rtFormatted = (rawRt ? rawRt : input.rtNumber).padStart(2, "0");

    let maxSeq = 0;
    for (const n of mockNasabah) {
      if (!n.username) continue;
      const match = n.username.match(new RegExp(`^${rtFormatted}(\\d{2,})$`));
      if (match && match[1]) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    const nextId = `${rtFormatted}${String(nextSeq).padStart(2, "0")}`;

    return ok({
      nextId,
      rt: rtFormatted,
      count: maxSeq,
    });
  },

  async resetPasswordPengguna(input) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
    if (activeSesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

    const parsed = ResetPasswordInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);

    if (parsed.data.userId === activeSesi.userId) {
      return fail("TIDAK_DIIZINKAN");
    }

    const targetUser = allUsersById.get(parsed.data.userId);
    if (!targetUser) return fail("PENGGUNA_TIDAK_DITEMUKAN");

    // Akun super_admin tidak boleh direset
    const targetRole = "role" in targetUser ? targetUser.role : "nasabah";
    if (targetRole === "super_admin" || (targetRole !== "admin" && targetRole !== "nasabah")) {
      return fail("TIDAK_DIIZINKAN");
    }

    const passwordSementara = genPassword();
    mockPasswords.set(parsed.data.userId, passwordSementara);
    mockMustChangePassword.set(parsed.data.userId, true);

    return ok({ passwordSementara });
  },

  async setStatusPengguna(input) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

    const parsed = SetStatusPenggunaInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);

    if (parsed.data.userId === activeSesi.userId) {
      return fail("TIDAK_BISA_NONAKTIFKAN_DIRI");
    }

    const nasabah = mockNasabah.find((n) => n.id === parsed.data.userId);
    if (nasabah) {
      nasabah.aktif = parsed.data.aktif;
      return ok({
        id: nasabah.id,
        username: nasabah.username,
        nama: nasabah.nama,
        role: "nasabah",
        aktif: nasabah.aktif,
      });
    }

    const staf = mockStaf.find((s) => s.id === parsed.data.userId);
    if (staf) {
      staf.aktif = parsed.data.aktif;
      return ok(staf);
    }

    return fail("PENGGUNA_TIDAK_DITEMUKAN");
  },

  // ── Jenis Sampah ─────────────────────────────────────────────────────────

  async simpanJenisSampah(input) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role !== "super_admin" && activeSesi.role !== "admin") return fail("TIDAK_DIIZINKAN");

    const parsed = SimpanJenisSampahInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);

    const userObj = allUsersById.get(activeSesi.userId);
    const userName = userObj ? userObj.nama : activeSesi.nama;
    const userUsername = userObj ? userObj.username : activeSesi.username;

    if (parsed.data.id) {
      const idx = mockJenisSampah.findIndex((j) => j.id === parsed.data.id);
      if (idx === -1) return fail("JENIS_SAMPAH_TIDAK_VALID");
      const existing = mockJenisSampah[idx];
      const hargaLama = existing.hargaBeli;
      const hargaBaru = parsed.data.hargaBeli;

      let terakhirDiubah = existing.terakhirDiubah;
      if (hargaLama !== hargaBaru) {
        terakhirDiubah = {
          waktu: nowIso(),
          hargaLama,
          hargaBaru,
          diubahOlehNama: userName,
        };
        const { mockRiwayatHarga } = await import("./_store");
        mockRiwayatHarga.unshift({
          id: nextId(),
          sampahId: existing.id,
          sampahNama: parsed.data.nama,
          hargaLama,
          hargaBaru,
          diubahOlehId: activeSesi.userId,
          diubahOlehNama: userName,
          diubahOlehUsername: userUsername,
          createdAt: nowIso(),
        });
      }

      mockJenisSampah[idx] = {
        ...existing,
        nama: parsed.data.nama,
        hargaBeli: hargaBaru,
        hargaJual: parsed.data.hargaJual !== undefined ? parsed.data.hargaJual : existing.hargaJual,
        aktif: parsed.data.aktif,
        terakhirDiubah,
      };
      return ok(mockJenisSampah[idx]);
    } else {
      const newId = nextId();
      const newJs: JenisSampah = {
        id: newId,
        nama: parsed.data.nama,
        hargaBeli: parsed.data.hargaBeli,
        hargaJual: parsed.data.hargaJual ?? Math.round(parsed.data.hargaBeli * 1.2),
        aktif: parsed.data.aktif,
        terakhirDiubah: {
          waktu: nowIso(),
          hargaLama: 0,
          hargaBaru: parsed.data.hargaBeli,
          diubahOlehNama: userName,
        },
      };
      mockJenisSampah.push(newJs);
      const { mockRiwayatHarga } = await import("./_store");
      mockRiwayatHarga.unshift({
        id: nextId(),
        sampahId: newId,
        sampahNama: parsed.data.nama,
        hargaLama: 0,
        hargaBaru: parsed.data.hargaBeli,
        diubahOlehId: activeSesi.userId,
        diubahOlehNama: userName,
        diubahOlehUsername: userUsername,
        createdAt: nowIso(),
      });
      return ok(newJs);
    }
  },

  async updateHargaSampah(input) {
    if (!activeSesi || (activeSesi.role !== "admin" && activeSesi.role !== "super_admin")) {
      throw new Error("Akses ditolak. Hanya admin yang dapat mengubah harga.");
    }
    return this.simpanJenisSampah(input);
  },

  // ── Transaksi ─────────────────────────────────────────────────────────────

  async setor(formData: FormData) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role === "nasabah") return fail("TIDAK_DIIZINKAN");

    const { payload, foto } = parseSetorFormData(formData);

    const parsed = SetorInputSchema.safeParse(payload);
    if (!parsed.success) return failDariZod(parsed.error);

    // Idempotensi
    if (clientRequestIndex.has(parsed.data.clientRequestId)) {
      const existingId = clientRequestIndex.get(parsed.data.clientRequestId)!;
      const existing = mockTransaksi.find((t) => t.id === existingId);
      if (existing) {
        const n = mockNasabah.find((x) => x.id === existing.customerId);
        return ok({
          transaksi: existing,
          saldoBaru: n ? n.saldo : 0,
          duplikat: true,
        });
      }
    }

    const nasabah = mockNasabah.find((n) => n.id === parsed.data.customerId);
    if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");
    if (!nasabah.aktif) return fail("NASABAH_NONAKTIF");

    let totalJumlah = 0;
    const items = [];
    for (const item of parsed.data.items) {
      const jenis = mockJenisSampah.find((j) => j.id === item.wasteTypeId && j.aktif);
      if (!jenis) return fail("JENIS_SAMPAH_TIDAK_VALID");
      const normBerat = normalisasiBerat(String(item.berat));
      const subtotal = estimasiSubtotal(normBerat, jenis.hargaBeli);
      if (subtotal <= 0) return fail("ITEM_TERLALU_KECIL");
      totalJumlah += subtotal;
      items.push({
        wasteTypeId: jenis.id,
        namaSampah: jenis.nama,
        berat: normBerat,
        hargaSnapshot: jenis.hargaBeli,
        subtotal,
      });
    }

    const newTransaksi: TransaksiDetail = {
      id: nextId(),
      tipe: "setor",
      jumlah: totalJumlah,
      waktu: nowIso(),
      catatan: parsed.data.catatan ?? null,
      dibuatOlehId: activeSesi.userId,
      dibuatOlehNama: activeSesi.nama,
      customerId: nasabah.id,
      customerNama: nasabah.nama,
      customerUsername: nasabah.username,
      items,
      fotoUrl: foto ? "https://placehold.co/400x300/2d9e5f/ffffff?text=Foto+Timbangan" : null,
      fotoUrlBerlakuHingga: foto ? "2026-12-31T23:59:59.000Z" : null,
      sudahDibalik: false,
      membalikId: null,
      dibalikOlehId: null,
    };

    mockTransaksi.push(newTransaksi);
    clientRequestIndex.set(parsed.data.clientRequestId, newTransaksi.id);
    nasabah.saldo += totalJumlah;

    return ok({
      transaksi: newTransaksi,
      saldoBaru: nasabah.saldo,
      duplikat: false,
    });
  },

  async tarik(input) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role === "nasabah") return fail("TIDAK_DIIZINKAN");

    const parsed = TarikInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);

    // Idempotensi
    if (clientRequestIndex.has(parsed.data.clientRequestId)) {
      const existingId = clientRequestIndex.get(parsed.data.clientRequestId)!;
      const existing = mockTransaksi.find((t) => t.id === existingId);
      if (existing) {
        const n = mockNasabah.find((x) => x.id === existing.customerId);
        return ok({
          transaksi: existing,
          saldoBaru: n ? n.saldo : 0,
          duplikat: true,
        });
      }
    }

    const nasabah = mockNasabah.find((n) => n.id === parsed.data.customerId);
    if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");
    if (!nasabah.aktif) return fail("NASABAH_NONAKTIF");

    if (nasabah.saldo < parsed.data.jumlah) {
      return fail("SALDO_TIDAK_CUKUP");
    }

    const newTransaksi: TransaksiDetail = {
      id: nextId(),
      tipe: "tarik",
      jumlah: -parsed.data.jumlah, // server mengubahnya jadi negatif
      waktu: nowIso(),
      catatan: parsed.data.catatan ?? null,
      dibuatOlehId: activeSesi.userId,
      dibuatOlehNama: activeSesi.nama,
      customerId: nasabah.id,
      customerNama: nasabah.nama,
      customerUsername: nasabah.username,
      items: [],
      fotoUrl: null,
      fotoUrlBerlakuHingga: null,
      sudahDibalik: false,
      membalikId: null,
      dibalikOlehId: null,
    };

    mockTransaksi.push(newTransaksi);
    clientRequestIndex.set(parsed.data.clientRequestId, newTransaksi.id);
    nasabah.saldo -= parsed.data.jumlah;

    return ok({
      transaksi: newTransaksi,
      saldoBaru: nasabah.saldo,
      duplikat: false,
    });
  },

  async koreksi(input) {
    await delay();
    if (!activeSesi) return fail("TIDAK_LOGIN");
    if (activeSesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

    const parsed = KoreksiInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);

    // Idempotensi
    if (clientRequestIndex.has(parsed.data.clientRequestId)) {
      const existingId = clientRequestIndex.get(parsed.data.clientRequestId)!;
      const existing = mockTransaksi.find((t) => t.id === existingId);
      if (existing) {
        const n = mockNasabah.find((x) => x.id === existing.customerId);
        return ok({
          transaksi: existing,
          saldoBaru: n ? n.saldo : 0,
          duplikat: true,
        });
      }
    }

    const asal = mockTransaksi.find((t) => t.id === parsed.data.transaksiId);
    if (!asal) return fail("TRANSAKSI_TIDAK_DITEMUKAN");
    if (asal.sudahDibalik) return fail("TRANSAKSI_SUDAH_DIBALIK");
    if (asal.tipe === "koreksi") return fail("TRANSAKSI_TIDAK_BISA_DIBALIK");

    const reversalJumlah = -asal.jumlah;
    const nasabah = mockNasabah.find((n) => n.id === asal.customerId);
    if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");

    if (nasabah.saldo + reversalJumlah < 0) {
      return fail("KOREKSI_MEMBUAT_SALDO_MINUS");
    }

    const newTransaksi: TransaksiDetail = {
      id: nextId(),
      tipe: "koreksi",
      jumlah: reversalJumlah,
      waktu: nowIso(),
      catatan: parsed.data.alasan,
      dibuatOlehId: activeSesi.userId,
      dibuatOlehNama: activeSesi.nama,
      customerId: nasabah.id,
      customerNama: nasabah.nama,
      customerUsername: nasabah.username,
      items: [],
      fotoUrl: null,
      fotoUrlBerlakuHingga: null,
      sudahDibalik: false,
      membalikId: asal.id,
      dibalikOlehId: null,
    };

    asal.sudahDibalik = true;
    asal.dibalikOlehId = newTransaksi.id;

    mockTransaksi.push(newTransaksi);
    clientRequestIndex.set(parsed.data.clientRequestId, newTransaksi.id);
    nasabah.saldo += reversalJumlah;

    return ok({
      transaksi: newTransaksi,
      saldoBaru: nasabah.saldo,
      duplikat: false,
    });
  },
};
