"use server";

// File "use server": hanya fungsi async yang diekspor (dipanggil dari Client Component).
// Objek `realActions` untuk saklar frontend ada di ./real-actions.ts.

import "server-only";
import { isAPIError } from "better-auth/api";
import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import {
  type ActionResult,
  BuatPenggunaInputSchema,
  type BuatPenggunaInput,
  fail,
  failDariZod,
  GantiPasswordInputSchema,
  type GantiPasswordInput,
  type JenisSampah,
  type KoreksiInput,
  KoreksiInputSchema,
  type LoginInput,
  LoginInputSchema,
  type MutasiResult,
  ok,
  parseSetorFormData,
  type PenggunaBaruResult,
  type PenggunaRingkas,
  ResetPasswordInputSchema,
  type ResetPasswordInput,
  type ResetPasswordResult,
  type SesiInfo,
  SetStatusPenggunaInputSchema,
  type SetStatusPenggunaInput,
  SetorInputSchema,
  SimpanJenisSampahInputSchema,
  type SimpanJenisSampahInput,
  type TarikInput,
  TarikInputSchema,
} from "@/contract";
import { idKeNumber } from "../angka";
import { auth } from "../auth";
import { db } from "../db";
import { user } from "../db/auth-schema";
import { wasteTypes } from "../db/schema";
import { constraintUnik, logServer, pgErrorDari, petaErrorDb } from "../errors";
import { fotoStorage } from "../foto/storage";
import { periksaFoto } from "../foto/validasi";
import type { SesiServer } from "../guards";
import { ipKlien } from "../ip";
import { mulaiPercobaan, percobaanBerhasil, percobaanGagal } from "../login-limit";
import { itemsKeJson, panggilLedger } from "../ledger";
import { alasanPasswordLemah } from "../password-umum";
import {
  buatPasswordSementara,
  buatPenggunaDenganPassword,
  hapusSemuaSesi,
  hapusSesiLain,
  resetKePasswordSementara,
} from "../pengguna";
import { muatTransaksiDetail } from "../transaksi";
import { jalankan } from "./_jalankan";

// ─── Auth ───────────────────────────────────────────────────────────────────

/**
 * Login tanpa guard (belum ada sesi). Semua kegagalan kredensial -- username tidak ada,
 * password salah, akun nonaktif -- menjadi KREDENSIAL_SALAH yang sama.
 */
export async function login(input: LoginInput): Promise<ActionResult<SesiInfo>> {
  try {
    const parsed = LoginInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);

    const h = await headers();
    // Plugin username menormalkan ke huruf kecil; kunci pembatas memakai bentuk yang sama.
    const username = parsed.data.username.toLowerCase();
    const ip = ipKlien(h);

    const percobaan = await mulaiPercobaan(username, ip);
    if (percobaan.terkunci) {
      return fail("TERLALU_BANYAK_PERCOBAAN", { retryAfterDetik: percobaan.retryAfterDetik });
    }

    let userId: string;
    try {
      const res = await auth.api.signInUsername({
        body: { username, password: parsed.data.password },
        headers: h,
      });
      userId = res.user.id;
    } catch (e) {
      if (!gagalKredensial(e)) throw e;
      await percobaanGagal();
      return fail("KREDENSIAL_SALAH");
    }

    await percobaanBerhasil(username, percobaan);

    const [u] = await db
      .select({
        username: user.username,
        nama: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      })
      .from(user)
      .where(eq(user.id, userId));
    return ok({
      userId,
      username: u.username ?? username,
      nama: u.nama,
      role: u.role,
      mustChangePassword: u.mustChangePassword,
    });
  } catch (e) {
    logServer("login", e);
    return fail("SERVER_ERROR");
  }
}

/**
 * Kegagalan yang berarti "kredensial tidak diterima". FAILED_TO_CREATE_SESSION muncul saat
 * hook sesi menolak akun nonaktif (server/auth.ts) -- sengaja disamakan dengan password salah.
 */
function gagalKredensial(e: unknown): boolean {
  if (!isAPIError(e)) return false;
  return (
    e.status === "UNAUTHORIZED" ||
    e.status === "UNPROCESSABLE_ENTITY" ||
    kodeApiError(e) === "FAILED_TO_CREATE_SESSION"
  );
}

function kodeApiError(e: unknown): string | undefined {
  return isAPIError(e) ? (e.body as { code?: string } | undefined)?.code : undefined;
}

/** Hapus sesi ini di DB dan cookie-nya (lewat plugin nextCookies). */
export async function logout(): Promise<ActionResult<null>> {
  return jalankan("logout", async () => {
    await auth.api.signOut({ headers: await headers() });
    return ok(null);
  });
}

/**
 * Ganti password sendiri. Tidak memakai auth.api.changePassword: endpoint itu menolak sesi
 * yang lebih tua dari freshAge (1 hari) dan tidak melewati pembatas login. Di sini password
 * lama yang salah dihitung sebagai percobaan login gagal untuk username yang sama.
 */
export async function gantiPassword(input: GantiPasswordInput): Promise<ActionResult<null>> {
  return jalankan("gantiPassword", async (sesi) => {
    const parsed = GantiPasswordInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const { passwordLama, passwordBaru } = parsed.data;

    const lemah = alasanPasswordLemah(passwordBaru, sesi.username);
    if (lemah) return fail("VALIDASI_GAGAL", { fieldErrors: { passwordBaru: [lemah] } });

    const ip = ipKlien(await headers());
    const percobaan = await mulaiPercobaan(sesi.username, ip);
    if (percobaan.terkunci) {
      return fail("TERLALU_BANYAK_PERCOBAAN", { retryAfterDetik: percobaan.retryAfterDetik });
    }

    const ctx = await auth.$context;
    const akun = await ctx.internalAdapter.findCredentialAccount(sesi.userId);
    const cocok = akun?.password ? await ctx.password.verify({ hash: akun.password, password: passwordLama }) : false;
    if (!cocok) {
      await percobaanGagal();
      return fail("PASSWORD_LAMA_SALAH");
    }
    await percobaanBerhasil(sesi.username, percobaan);

    await ctx.internalAdapter.updatePassword(sesi.userId, await ctx.password.hash(passwordBaru));
    await ctx.internalAdapter.updateUser(sesi.userId, { mustChangePassword: false });
    await hapusSesiLain(sesi.userId, sesi.sessionToken);
    return ok(null);
  });
}

// ─── Pengguna (super_admin) ─────────────────────────────────────────────────

async function penggunaRingkas(userId: string): Promise<PenggunaRingkas | null> {
  const [u] = await db
    .select({ id: user.id, username: user.username, nama: user.name, role: user.role, aktif: user.aktif })
    .from(user)
    .where(eq(user.id, userId));
  return u ? { ...u, username: u.username ?? "" } : null;
}

export async function buatPengguna(input: BuatPenggunaInput): Promise<ActionResult<PenggunaBaruResult>> {
  return jalankan("buatPengguna", async () => {
    const parsed = BuatPenggunaInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const { role, username, nama } = parsed.data;

    const [ada] = await db.select({ id: user.id }).from(user).where(eq(user.username, username));
    if (ada) return fail("USERNAME_SUDAH_ADA");

    const passwordSementara = buatPasswordSementara();
    let userId: string;
    try {
      userId = await buatPenggunaDenganPassword({ username, nama, role, password: passwordSementara, mustChangePassword: true });
    } catch (e) {
      // Balapan dua permintaan dengan username sama: hook plugin username
      // (USERNAME_IS_ALREADY_TAKEN) atau unique index yang memutuskan.
      if (constraintUnik(e) !== null || kodeApiError(e) === "USERNAME_IS_ALREADY_TAKEN") {
        return fail("USERNAME_SUDAH_ADA");
      }
      throw e;
    }
    const pengguna = await penggunaRingkas(userId);
    if (!pengguna) throw new Error("pengguna baru tidak terbaca");
    return ok({ pengguna, passwordSementara });
  });
}

export async function resetPasswordPengguna(input: ResetPasswordInput): Promise<ActionResult<ResetPasswordResult>> {
  return jalankan("resetPasswordPengguna", async () => {
    const parsed = ResetPasswordInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);

    const target = await penggunaRingkas(parsed.data.userId);
    if (!target) return fail("PENGGUNA_TIDAK_DITEMUKAN");
    const passwordSementara = await resetKePasswordSementara(target.id, target.username);
    return ok({ passwordSementara });
  });
}

export async function setStatusPengguna(input: SetStatusPenggunaInput): Promise<ActionResult<PenggunaRingkas>> {
  return jalankan("setStatusPengguna", async (sesi) => {
    const parsed = SetStatusPenggunaInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const { userId, aktif } = parsed.data;

    if (userId === sesi.userId && !aktif) return fail("TIDAK_BISA_NONAKTIFKAN_DIRI");
    const [u] = await db.update(user).set({ aktif, updatedAt: new Date() }).where(eq(user.id, userId)).returning({ id: user.id });
    if (!u) return fail("PENGGUNA_TIDAK_DITEMUKAN");
    if (!aktif) await hapusSemuaSesi(userId);

    const pengguna = await penggunaRingkas(userId);
    if (!pengguna) return fail("PENGGUNA_TIDAK_DITEMUKAN");
    return ok(pengguna);
  });
}

// ─── Jenis sampah (super_admin) ─────────────────────────────────────────────

export async function simpanJenisSampah(input: SimpanJenisSampahInput): Promise<ActionResult<JenisSampah>> {
  return jalankan("simpanJenisSampah", async () => {
    const parsed = SimpanJenisSampahInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const { id, nama, hargaBeli, aktif } = parsed.data;

    try {
      let row: { id: number; nama: string; hargaBeli: number; aktif: boolean } | undefined;
      if (id === undefined) {
        [row] = await db.insert(wasteTypes).values({ nama, hargaBeli, aktif }).returning();
      } else {
        const idNum = idKeNumber(id);
        if (idNum !== null) {
          [row] = await db.update(wasteTypes).set({ nama, hargaBeli, aktif }).where(eq(wasteTypes.id, idNum)).returning();
        }
        if (!row) return fail("JENIS_SAMPAH_TIDAK_VALID");
      }
      return ok({ id: String(row.id), nama: row.nama, hargaBeli: row.hargaBeli, aktif: row.aktif });
    } catch (e) {
      if (constraintUnik(e) === "waste_types_nama_unique") {
        return fail("VALIDASI_GAGAL", { fieldErrors: { nama: ["Nama jenis sampah sudah dipakai"] } });
      }
      throw e;
    }
  });
}

// ─── Ledger (setor, tarik, koreksi) ─────────────────────────────────────────

/** MutasiResult memakai TransaksiDetail dari fungsi yang SAMA dengan getTransaksi. */
async function hasilMutasi(
  h: { transactionId: string; saldoBaru: number; duplikat: boolean },
  sesi: SesiServer,
): Promise<ActionResult<MutasiResult>> {
  const [transaksi] = await muatTransaksiDetail([h.transactionId], sesi);
  if (!transaksi) throw new Error(`transaksi ${h.transactionId} tidak terbaca setelah mutasi`);
  return ok({ transaksi, saldoBaru: h.saldoBaru, duplikat: h.duplikat });
}

/** Error dari fungsi SQL: kode kontrak dikembalikan, selain itu dilempar (SERVER_ERROR + log). */
function kodeLedger(nama: string, e: unknown) {
  const kode = petaErrorDb(nama, e);
  if (kode === "SERVER_ERROR") throw e;
  return fail(kode);
}

/**
 * Setor dengan foto timbangan (FormData: "payload" JSON + "foto"). Foto diunggah dulu dengan
 * nama acak; bila SQL menolak atau permintaan ternyata duplikat (clientRequestId sama), file
 * BARU itu dihapus lagi. File milik transaksi asli tidak pernah disentuh.
 */
export async function setor(formData: FormData): Promise<ActionResult<MutasiResult>> {
  return jalankan("setor", async (sesi) => {
    const { payload, foto } = parseSetorFormData(formData);
    const parsed = SetorInputSchema.safeParse(payload);
    if (!parsed.success) return failDariZod(parsed.error);
    const input = parsed.data;

    const f = await periksaFoto(foto);
    if (!f.ok) return fail(f.kode);

    const items = itemsKeJson(input.items);
    if (items === null) return fail("JENIS_SAMPAH_TIDAK_VALID");

    const storage = fotoStorage();
    await storage.simpan(f.namaAcak, f.bytes, f.mime);
    const hapusFotoBaru = () =>
      storage.hapus(f.namaAcak).catch((e: unknown) => logServer("setor:hapus-foto", e));

    let hasil;
    try {
      hasil = await panggilLedger(sql`
        select * from public.setor(
          ${input.customerId}, ${sesi.userId},
          ${input.clientRequestId}::uuid, ${items}::text::jsonb,
          ${f.namaAcak}, ${f.sha256}, ${input.catatan || null}
        )`);
    } catch (e) {
      // Hanya bila DB menjawab dengan error (statement pasti di-rollback). Gangguan koneksi:
      // hasil tidak pasti, file dibiarkan (yatim lebih aman daripada transaksi tanpa foto).
      if (pgErrorDari(e)) await hapusFotoBaru();
      return kodeLedger("setor", e);
    }
    if (hasil.duplikat) await hapusFotoBaru();
    return hasilMutasi(hasil, sesi);
  });
}

export async function tarik(input: TarikInput): Promise<ActionResult<MutasiResult>> {
  return jalankan("tarik", async (sesi) => {
    const parsed = TarikInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const { customerId, jumlah, catatan, clientRequestId } = parsed.data;
    let hasil;
    try {
      hasil = await panggilLedger(sql`
        select * from public.tarik(
          ${customerId}, ${sesi.userId}, ${clientRequestId}::uuid, ${jumlah}::integer, ${catatan || null}
        )`);
    } catch (e) {
      return kodeLedger("tarik", e);
    }
    return hasilMutasi(hasil, sesi);
  });
}

export async function koreksi(input: KoreksiInput): Promise<ActionResult<MutasiResult>> {
  return jalankan("koreksi", async (sesi) => {
    const parsed = KoreksiInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);
    const { transaksiId, alasan, clientRequestId } = parsed.data;
    let hasil;
    try {
      hasil = await panggilLedger(sql`
        select * from public.koreksi(
          ${transaksiId}::bigint, ${sesi.userId}, ${clientRequestId}::uuid, ${alasan}
        )`);
    } catch (e) {
      return kodeLedger("koreksi", e);
    }
    return hasilMutasi(hasil, sesi);
  });
}
