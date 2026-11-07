"use server";

/**
 * lib/api/mock/server-actions.ts
 *
 * Implementasi MOCK dari Actions sebagai Server Action (sama seperti backend asli), supaya
 * perubahan tersimpan di store yang sama dengan yang dibaca query mock di server.
 * File "use server" hanya boleh mengekspor fungsi async; objek `mockActions` ada di ./actions.ts.
 * Semua perubahan disimpan ke _store.ts (in-memory, hilang saat restart).
 */

import "server-only";
import type {
  ActionResult,
  BuatPenggunaInput,
  GantiPasswordInput,
  GetLatestIdByRtInput,
  LatestIdByRtResult,
  JenisSampah,
  KoreksiInput,
  LoginInput,
  MutasiResult,
  PenyesuaianInput,
  NasabahRingkas,
  PenggunaBaruResult,
  PenggunaRingkas,
  ResetPasswordInput,
  ResetPasswordResult,
  Role,
  Rupiah,
  SesiInfo,
  SetStatusPenggunaInput,
  SimpanJenisSampahInput,
  TarikInput,
  TipeTransaksi,
  TransaksiDetail,
  UserId,
} from "@/contract";
import {
  ok,
  fail,
  failDariZod,
  FOTO_MIME,
  LIMIT,
  normalisasiBerat,
  estimasiSubtotal,
  parseSetorFormData,
  LoginInputSchema,
  GantiPasswordInputSchema,
  GetLatestIdByRtInputSchema,
  BuatPenggunaInputSchema,
  ResetPasswordInputSchema,
  SetStatusPenggunaInputSchema,
  SimpanJenisSampahInputSchema,
  SetorInputSchema,
  TarikInputSchema,
  KoreksiInputSchema,
  PenyesuaianInputSchema,
} from "@/contract";
import { createHash, randomInt } from "node:crypto";
import { guard } from "./_guard";
import { store, nextId, nowIso } from "./_store";

/** Delay palsu (50ms). */
const delay = () => new Promise<void>((r) => setTimeout(r, 50));

/** Password sementara seperti backend: 10 karakter, crypto.randomInt, tanpa 0/O/1/l/I. */
const ALFABET_PASSWORD = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function genPassword(): string {
  let hasil = "";
  for (let i = 0; i < 10; i++) hasil += ALFABET_PASSWORD[randomInt(ALFABET_PASSWORD.length)];
  return hasil;
}

/**
 * Idempotensi (seperti cek_request_ulang di SQL): clientRequestId yang sudah diproses ->
 * transaksi aslinya; dipakai untuk operasi/nasabah/petugas lain -> VALIDASI_GAGAL.
 */
function hasilDuplikat(
  clientRequestId: string,
  harap: { tipe: TipeTransaksi; customerId: string | undefined; adminId: string; membalikId: string | null },
): ActionResult<MutasiResult> | null {
  const existingId = store.clientRequestIndex.get(clientRequestId);
  const existing = existingId && store.transaksi.find((t) => t.id === existingId);
  if (!existing) return null;
  if (
    existing.tipe !== harap.tipe ||
    existing.customerId !== harap.customerId ||
    existing.dibuatOlehId !== harap.adminId ||
    existing.membalikId !== harap.membalikId
  ) {
    return fail("VALIDASI_GAGAL");
  }
  const n = store.nasabah.find((x) => x.id === existing.customerId);
  return ok({ transaksi: existing, saldoBaru: n ? n.saldo : 0, duplikat: true });
}

/** Foto: tipe yang diklaim harus cocok dengan isi (magic bytes), maks LIMIT.FOTO_MAKS_BYTES. */
function fotoValid(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length === 0 || bytes.length > LIMIT.FOTO_MAKS_BYTES) return false;
  if (!(FOTO_MIME as readonly string[]).includes(mime)) return false;
  const awal = (...b: number[]) => b.every((x, i) => bytes[i] === x);
  if (mime === "image/jpeg") return awal(0xff, 0xd8, 0xff);
  if (mime === "image/png") return awal(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  const teks = (a: number, b: number) => String.fromCharCode(...bytes.slice(a, b));
  return teks(0, 4) === "RIFF" && teks(8, 12) === "WEBP";
}

// ── Auth ────────────────────────────────────────────────────────────────────

export async function login(input: LoginInput): Promise<ActionResult<SesiInfo>> {
  await delay();
  const parsed = LoginInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const user = store.usersByUsername.get(parsed.data.username.toLowerCase());
  if (!user) return fail("KREDENSIAL_SALAH");

  const stored = store.passwords.get(user.id as UserId);
  if (stored !== parsed.data.password) return fail("KREDENSIAL_SALAH");

  const nasabah = store.nasabah.find((n) => n.id === user.id);
  const staf = store.staf.find((s) => s.id === user.id);
  const aktif = nasabah?.aktif ?? staf?.aktif ?? false;
  // Sama dengan backend: akun nonaktif tidak dibedakan dari kredensial salah.
  if (!aktif) return fail("KREDENSIAL_SALAH");

  const role: Role = staf?.role ?? "nasabah";
  const mustChange = store.mustChangePassword.get(user.id as UserId) ?? false;
  const sesi: SesiInfo = {
    userId: user.id as UserId,
    username: user.username,
    nama: user.nama,
    role,
    mustChangePassword: mustChange,
  };
  store.sesi = sesi;
  return ok(sesi);
}

export async function logout(): Promise<ActionResult<null>> {
  await delay();
  const g = guard("logout");
  if (!g.ok) return g.hasil;
  store.sesi = null;
  return ok(null);
}

export async function gantiPassword(input: GantiPasswordInput): Promise<ActionResult<null>> {
  await delay();
  const g = guard("gantiPassword");
  if (!g.ok) return g.hasil;
  const sesi = g.sesi;
  const parsed = GantiPasswordInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const stored = store.passwords.get(sesi.userId);
  if (stored !== parsed.data.passwordLama) {
    return fail("PASSWORD_LAMA_SALAH");
  }

  store.passwords.set(sesi.userId, parsed.data.passwordBaru);
  store.mustChangePassword.set(sesi.userId, false);
  store.sesi = { ...sesi, mustChangePassword: false };
  return ok(null);
}

// ── Manajemen Pengguna (SA) ─────────────────────────────────────────────────

export async function buatPengguna(input: BuatPenggunaInput): Promise<ActionResult<PenggunaBaruResult>> {
  await delay();
  const g = guard("buatPengguna");
  if (!g.ok) return g.hasil;
  const sesi = g.sesi;

  const parsed = BuatPenggunaInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);
  if (sesi.role === "admin" && parsed.data.role !== "nasabah") return fail("TIDAK_DIIZINKAN");

  if (store.usersByUsername.has(parsed.data.username)) {
    return fail("USERNAME_SUDAH_ADA");
  }

  const userId = `user-${Date.now()}` as UserId;
  const passwordSementara = genPassword();

  store.passwords.set(userId, passwordSementara);
  store.mustChangePassword.set(userId, true);
  store.dibuatPada.set(userId, nowIso());

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
    store.nasabah.push(newNasabah);
    store.usersByUsername.set(parsed.data.username, newNasabah);
    store.usersById.set(userId, newNasabah);
  } else {
    store.staf.push(pengguna);
    store.usersByUsername.set(parsed.data.username, pengguna);
    store.usersById.set(userId, pengguna);
  }

  return ok({ pengguna, passwordSementara });
}

export async function getLatestIdByRt(input: GetLatestIdByRtInput): Promise<ActionResult<LatestIdByRtResult>> {
  await delay();
  const g = guard("getLatestIdByRt");
  if (!g.ok) return g.hasil;
  const parsed = GetLatestIdByRtInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);
  const rt = parsed.data.rtNumber.padStart(2, "0");
  const pola = new RegExp(`^${rt}(\\d{2,6})$`);
  const count = store.nasabah.reduce((maks, n) => {
    const m = pola.exec(n.username);
    return m ? Math.max(maks, Number(m[1])) : maks;
  }, 0);
  return ok({ nextId: `${rt}${String(count + 1).padStart(2, "0")}`, rt, count });
}

export async function resetPasswordPengguna(input: ResetPasswordInput): Promise<ActionResult<ResetPasswordResult>> {
  await delay();
  const g = guard("resetPasswordPengguna");
  if (!g.ok) return g.hasil;

  const parsed = ResetPasswordInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  if (!store.usersById.has(parsed.data.userId)) return fail("PENGGUNA_TIDAK_DITEMUKAN");

  const passwordSementara = genPassword();
  store.passwords.set(parsed.data.userId, passwordSementara);
  store.mustChangePassword.set(parsed.data.userId, true);

  return ok({ passwordSementara });
}

export async function setStatusPengguna(input: SetStatusPenggunaInput): Promise<ActionResult<PenggunaRingkas>> {
  await delay();
  const g = guard("setStatusPengguna");
  if (!g.ok) return g.hasil;
  const sesi = g.sesi;

  const parsed = SetStatusPenggunaInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  if (parsed.data.userId === sesi.userId && !parsed.data.aktif) {
    return fail("TIDAK_BISA_NONAKTIFKAN_DIRI");
  }

  const nasabah = store.nasabah.find((n) => n.id === parsed.data.userId);
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

  const staf = store.staf.find((s) => s.id === parsed.data.userId);
  if (staf) {
    staf.aktif = parsed.data.aktif;
    return ok(staf);
  }

  return fail("PENGGUNA_TIDAK_DITEMUKAN");
}

// ── Jenis Sampah ────────────────────────────────────────────────────────────

export async function simpanJenisSampah(input: SimpanJenisSampahInput): Promise<ActionResult<JenisSampah>> {
  await delay();
  const g = guard("simpanJenisSampah");
  if (!g.ok) return g.hasil;
  const sesi = g.sesi;

  const parsed = SimpanJenisSampahInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);
  const { id, nama, hargaBeli, hargaJual, aktif } = parsed.data;
  const kunci = (v: string) => v.trim().toLowerCase();
  if (store.jenisSampah.some((j) => j.id !== id && kunci(j.nama) === kunci(nama))) {
    return fail("VALIDASI_GAGAL", { fieldErrors: { nama: ["Nama jenis sampah sudah dipakai"] } });
  }

  const catat = (j: JenisSampah, hargaLama: number) => {
    const waktu = nowIso();
    store.riwayatHarga.push({
      id: `rh-${nextId()}`,
      sampahId: j.id,
      sampahNama: j.nama,
      hargaLama,
      hargaBaru: j.hargaBeli,
      diubahOlehId: sesi.userId,
      diubahOlehNama: sesi.nama,
      diubahOlehUsername: sesi.username,
      createdAt: waktu,
    });
    j.terakhirDiubah = { waktu, hargaLama, hargaBaru: j.hargaBeli, diubahOlehNama: sesi.nama };
  };

  if (id) {
    const lama = store.jenisSampah.find((j) => j.id === id);
    if (!lama) return fail("JENIS_SAMPAH_TIDAK_VALID");
    const hargaLama = lama.hargaBeli;
    Object.assign(lama, { nama, hargaBeli, aktif, ...(hargaJual !== undefined ? { hargaJual } : {}) });
    if (hargaLama !== hargaBeli) catat(lama, hargaLama);
    return ok(lama);
  }

  const newJs: JenisSampah = { id: nextId(), nama, hargaBeli, hargaJual: hargaJual ?? null, aktif, terakhirDiubah: null };
  store.jenisSampah.push(newJs);
  catat(newJs, 0);
  return ok(newJs);
}

export async function updateHargaSampah(input: SimpanJenisSampahInput): Promise<ActionResult<JenisSampah>> {
  return simpanJenisSampah(input);
}

// ── Transaksi ───────────────────────────────────────────────────────────────

export async function setor(formData: FormData): Promise<ActionResult<MutasiResult>> {
  await delay();
  const g = guard("setor");
  if (!g.ok) return g.hasil;
  const sesi = g.sesi;

  const { payload, foto } = parseSetorFormData(formData);
  const parsed = SetorInputSchema.safeParse(payload);
  if (!parsed.success) return failDariZod(parsed.error);
  if (!foto) return fail("FOTO_WAJIB");
  const bytes = new Uint8Array(await foto.arrayBuffer());
  if (!fotoValid(bytes, foto.type)) return fail("FOTO_TIDAK_VALID");

  const duplikat = hasilDuplikat(parsed.data.clientRequestId, {
    tipe: "setor",
    customerId: parsed.data.customerId,
    adminId: sesi.userId,
    membalikId: null,
  });
  if (duplikat) return duplikat;

  // Foto yang sama hanya boleh dipakai lagi bila setor sebelumnya sudah dikoreksi.
  const hash = createHash("sha256").update(bytes).digest("hex");
  const pemakai = store.hashFoto.get(hash);
  if (pemakai && !store.transaksi.find((t) => t.id === pemakai)?.sudahDibalik) return fail("FOTO_SUDAH_DIPAKAI");

  const nasabah = store.nasabah.find((n) => n.id === parsed.data.customerId);
  if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");
  if (!nasabah.aktif) return fail("NASABAH_NONAKTIF");

  let totalJumlah = 0;
  const items = [];
  for (const item of parsed.data.items) {
    const jenis = store.jenisSampah.find((j) => j.id === item.wasteTypeId && j.aktif);
    if (!jenis) return fail("JENIS_SAMPAH_TIDAK_VALID");
    const normBerat = normalisasiBerat(item.berat);
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
    dibuatOlehId: sesi.userId,
    dibuatOlehNama: sesi.nama,
    customerId: nasabah.id,
    customerNama: nasabah.nama,
    customerUsername: nasabah.username,
    items,
    fotoUrl: "https://placehold.co/400x300/2d9e5f/ffffff?text=Foto+Timbangan",
    fotoUrlBerlakuHingga: "2026-12-31T23:59:59.000Z",
    sudahDibalik: false,
    membalikId: null,
    dibalikOlehId: null,
  };

  store.transaksi.push(newTransaksi);
  store.clientRequestIndex.set(parsed.data.clientRequestId, newTransaksi.id);
  store.hashFoto.set(hash, newTransaksi.id);
  nasabah.saldo += totalJumlah;

  return ok({
    transaksi: newTransaksi,
    saldoBaru: nasabah.saldo,
    duplikat: false,
  });
}

export async function tarik(input: TarikInput): Promise<ActionResult<MutasiResult>> {
  await delay();
  const g = guard("tarik");
  if (!g.ok) return g.hasil;
  const sesi = g.sesi;

  const parsed = TarikInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const duplikat = hasilDuplikat(parsed.data.clientRequestId, {
    tipe: "tarik",
    customerId: parsed.data.customerId,
    adminId: sesi.userId,
    membalikId: null,
  });
  if (duplikat) return duplikat;

  // Nasabah nonaktif tetap boleh ditarik (sisa saldo hak nasabah), sama dengan backend.
  const nasabah = store.nasabah.find((n) => n.id === parsed.data.customerId);
  if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");

  if (nasabah.saldo < parsed.data.jumlah) {
    return fail("SALDO_TIDAK_CUKUP");
  }

  const newTransaksi: TransaksiDetail = {
    id: nextId(),
    tipe: "tarik",
    jumlah: -parsed.data.jumlah, // server mengubahnya jadi negatif
    waktu: nowIso(),
    catatan: parsed.data.catatan ?? null,
    dibuatOlehId: sesi.userId,
    dibuatOlehNama: sesi.nama,
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

  store.transaksi.push(newTransaksi);
  store.clientRequestIndex.set(parsed.data.clientRequestId, newTransaksi.id);
  nasabah.saldo -= parsed.data.jumlah;

  return ok({
    transaksi: newTransaksi,
    saldoBaru: nasabah.saldo,
    duplikat: false,
  });
}

export async function koreksi(input: KoreksiInput): Promise<ActionResult<MutasiResult>> {
  await delay();
  const g = guard("koreksi");
  if (!g.ok) return g.hasil;
  const sesi = g.sesi;

  const parsed = KoreksiInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const duplikat = hasilDuplikat(parsed.data.clientRequestId, {
    tipe: "koreksi",
    customerId: store.transaksi.find((t) => t.id === parsed.data.transaksiId)?.customerId,
    adminId: sesi.userId,
    membalikId: parsed.data.transaksiId,
  });
  if (duplikat) return duplikat;

  const asal = store.transaksi.find((t) => t.id === parsed.data.transaksiId);
  if (!asal) return fail("TRANSAKSI_TIDAK_DITEMUKAN");
  if (asal.sudahDibalik) return fail("TRANSAKSI_SUDAH_DIBALIK");
  if (asal.tipe === "koreksi") return fail("TRANSAKSI_TIDAK_BISA_DIBALIK");

  const reversalJumlah = -asal.jumlah;
  const nasabah = store.nasabah.find((n) => n.id === asal.customerId);
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
    dibuatOlehId: sesi.userId,
    dibuatOlehNama: sesi.nama,
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

  store.transaksi.push(newTransaksi);
  store.clientRequestIndex.set(parsed.data.clientRequestId, newTransaksi.id);
  nasabah.saldo += reversalJumlah;

  return ok({
    transaksi: newTransaksi,
    saldoBaru: nasabah.saldo,
    duplikat: false,
  });
}

export async function sesuaikanSaldo(input: PenyesuaianInput): Promise<ActionResult<MutasiResult>> {
  await delay();
  const g = guard("sesuaikanSaldo");
  if (!g.ok) return g.hasil;
  const sesi = g.sesi;

  const parsed = PenyesuaianInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const duplikat = hasilDuplikat(parsed.data.clientRequestId, {
    tipe: "penyesuaian",
    customerId: parsed.data.customerId,
    adminId: sesi.userId,
    membalikId: null,
  });
  if (duplikat) return duplikat;

  const nasabah = store.nasabah.find((n) => n.id === parsed.data.customerId);
  if (!nasabah) return fail("NASABAH_TIDAK_DITEMUKAN");
  if (nasabah.saldo + parsed.data.jumlah < 0) return fail("SALDO_TIDAK_CUKUP");

  const newTransaksi: TransaksiDetail = {
    id: nextId(),
    tipe: "penyesuaian",
    jumlah: parsed.data.jumlah,
    waktu: nowIso(),
    catatan: parsed.data.alasan,
    dibuatOlehId: sesi.userId,
    dibuatOlehNama: sesi.nama,
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
  store.transaksi.push(newTransaksi);
  store.clientRequestIndex.set(parsed.data.clientRequestId, newTransaksi.id);
  nasabah.saldo += parsed.data.jumlah;
  return ok({ transaksi: newTransaksi, saldoBaru: nasabah.saldo, duplikat: false });
}
