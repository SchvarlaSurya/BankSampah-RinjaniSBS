/**
 * contract/index.ts
 *
 * KONTRAK BACKEND <-> FRONTEND — Bank Sampah, Fase 1
 * Versi: 1.0
 *
 * File ini adalah SUMBER KEBENARAN tunggal. Dipakai bersama oleh:
 *  - frontend (form, tipe data, pesan error)
 *  - backend  (validasi input, bentuk hasil, kode error)
 *
 * ATURAN:
 *  1. Jangan diubah diam-diam. Ubah lewat PR yang direview kedua pihak.
 *  2. File ini TIDAK boleh mengimpor apa pun selain "zod" (tanpa server-only,
 *     tanpa drizzle, tanpa react) supaya aman diimpor dari client maupun server.
 *  3. Semua nilai yang melintasi batas server -> client harus serializable:
 *     tidak ada Date, bigint, Map, Set. Lihat aturan serialisasi di bawah.
 */

import { z } from "zod";

/* ========================================================================== */
/* 1. ATURAN SERIALISASI                                                       */
/* ========================================================================== */
/**
 * - IdStr     : id bigint dari Postgres, DIKIRIM SEBAGAI STRING ("123").
 *               Jangan di-Number(): id bisa melewati batas aman JS.
 * - UserId    : id user (Better Auth) berupa string.
 * - Rupiah    : integer (number). Tidak ada desimal. Tanda +/- hanya pada
 *               TransaksiRingkas.jumlah (setor +, tarik -, koreksi = kebalikan asli,
 *               penyesuaian = + atau - sesuai input) dan PenyesuaianInput.jumlah.
 * - BeratStr  : string desimal SELALU 2 angka di belakang titik, "12.50".
 *               Jangan diubah ke float untuk dihitung uangnya.
 * - IsoUtc    : string ISO-8601 UTC, "2026-09-30T12:21:08.000Z".
 *               Tampilkan di UI dengan zona Asia/Jakarta.
 */
export type IdStr = string;
export type UserId = string;
export type Rupiah = number;
export type BeratStr = string;
export type IsoUtc = string;

/* ========================================================================== */
/* 2. ENUM & KONSTANTA BATAS                                                   */
/* ========================================================================== */
export const ROLES = ["super_admin", "admin", "nasabah"] as const;
export type Role = (typeof ROLES)[number];

export const TIPE_TRANSAKSI = ["setor", "tarik", "koreksi", "penyesuaian"] as const;
export type TipeTransaksi = (typeof TIPE_TRANSAKSI)[number];

export const LIMIT = {
  MAKS_ITEM_PER_SETOR: 20,
  MAKS_BERAT_KG: 10_000, // per item
  MAKS_TARIK_RUPIAH: 100_000_000,
  MAKS_HARGA_BELI_PER_KG: 1_000_000,
  PASSWORD_MIN: 8,
  PASSWORD_MAKS: 128,
  CATATAN_MAKS: 200,
  ALASAN_MIN: 5,
  ALASAN_MAKS: 300,
  HISTORI_DEFAULT: 20,
  HISTORI_MAKS: 50,
  /** Foto: klien mengompres ke <= FOTO_TARGET_KB; server menolak > FOTO_MAKS_BYTES. */
  FOTO_TARGET_KB: 500,
  FOTO_MAKS_BYTES: 1_500_000,
} as const;

export const FOTO_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Presence admin (POST /api/admin/presence). Heartbeat hanya saat tab terlihat; dianggap online
 * bila heartbeat terakhir dalam ONLINE_DETIK. Dashboard memuat ulang daftar tiap POLL_MS.
 */
export const PRESENCE = {
  HEARTBEAT_MS: 30_000,
  ONLINE_DETIK: 90,
  POLL_MS: 10_000,
} as const;

export const ZONA_WAKTU = "Asia/Jakarta";

/** Batas ukuran foto profil (KB). Ubah di sini saja; klien & server membaca konstanta ini. */
export const AVATAR_MAX_KB = 500;

/** Foto profil (semua role). Klien mengecilkan ke TARGET_DIMENSI sebelum unggah. */
export const AVATAR = {
  MAKS_KB: AVATAR_MAX_KB,
  MAKS_BYTES: AVATAR_MAX_KB * 1024,
  /** Dimensi maksimal yang diterima server (px, lebar & tinggi). */
  MAKS_DIMENSI: 1024,
  /** Ukuran hasil kompres klien dan hasil re-encode server (persegi, px). */
  TARGET_DIMENSI: 512,
  MAKS_UNGGAH_PER_JAM: 5,
} as const;

/** "Foto terlalu besar (812 KB). Maksimal 500 KB." */
export function pesanFotoTerlaluBesar(bytes: number): string {
  return `Foto terlalu besar (${Math.ceil(bytes / 1024)} KB). Maksimal ${AVATAR.MAKS_KB} KB.`;
}

/**
 * URL foto profil (route yang mengecek sesi, bukan URL publik). `versi` = waktu foto terakhir
 * diubah, supaya cache browser berganti saat foto diganti. null = tanpa foto (tampilkan inisial).
 */
export function urlFotoProfil(userId: string, versi: string | null): string | null {
  return versi ? `/api/foto-profil/${encodeURIComponent(userId)}?v=${encodeURIComponent(versi)}` : null;
}

/** Rute tetap. Frontend membuat halaman persis di path ini. */
export const ROUTES = {
  login: "/login",
  gantiPassword: "/ganti-password",
  home: {
    super_admin: "/admin",
    admin: "/admin",
    nasabah: "/nasabah",
  } satisfies Record<Role, string>,
} as const;

/* ========================================================================== */
/* 3. KODE ERROR                                                               */
/* ========================================================================== */
export const ERROR_CODES = [
  // sesi & akses
  "TIDAK_LOGIN",
  "WAJIB_GANTI_PASSWORD",
  "TIDAK_DIIZINKAN",
  "KREDENSIAL_SALAH",
  "TERLALU_BANYAK_PERCOBAAN",
  // umum
  "VALIDASI_GAGAL",
  "SERVER_ERROR",
  // pengguna
  "PASSWORD_LAMA_SALAH",
  "USERNAME_SUDAH_ADA",
  "PENGGUNA_TIDAK_DITEMUKAN",
  "TIDAK_BISA_NONAKTIFKAN_DIRI",
  "TIDAK_BISA_HAPUS_DIRI",
  "AKUN_PUNYA_RIWAYAT",
  "SUPER_ADMIN_TERAKHIR",
  // nasabah & jenis sampah
  "NASABAH_TIDAK_DITEMUKAN",
  "NASABAH_NONAKTIF",
  "JENIS_SAMPAH_TIDAK_VALID",
  // setor
  "FOTO_WAJIB",
  "FOTO_TIDAK_VALID",
  "FOTO_SUDAH_DIPAKAI",
  "FOTO_TERLALU_BESAR",
  "ITEM_TERLALU_KECIL",
  // tarik
  "SALDO_TIDAK_CUKUP",
  // koreksi
  "TRANSAKSI_TIDAK_DITEMUKAN",
  "TRANSAKSI_SUDAH_DIBALIK",
  "TRANSAKSI_TIDAK_BISA_DIBALIK",
  "KOREKSI_MEMBUAT_SALDO_MINUS",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(x: unknown): x is ErrorCode {
  return typeof x === "string" && (ERROR_CODES as readonly string[]).includes(x);
}

/**
 * Kode yang BOLEH di-RAISE oleh fungsi SQL (setor/tarik/koreksi).
 * Aturan: RAISE EXCEPTION USING MESSAGE = '<KODE>' — isi MESSAGE sama persis
 * dengan kode ini, tanpa teks tambahan.
 */
export const DB_ERROR_CODES = [
  "TIDAK_DIIZINKAN",
  "VALIDASI_GAGAL",
  "NASABAH_TIDAK_DITEMUKAN",
  "NASABAH_NONAKTIF",
  "JENIS_SAMPAH_TIDAK_VALID",
  "FOTO_SUDAH_DIPAKAI",
  "ITEM_TERLALU_KECIL",
  "SALDO_TIDAK_CUKUP",
  "TRANSAKSI_TIDAK_DITEMUKAN",
  "TRANSAKSI_SUDAH_DIBALIK",
  "TRANSAKSI_TIDAK_BISA_DIBALIK",
  "KOREKSI_MEMBUAT_SALDO_MINUS",
] as const satisfies readonly ErrorCode[];

/** Pesan siap tampil untuk pengguna. Frontend memakai ini, bukan pesan mentah. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  TIDAK_LOGIN: "Sesi berakhir. Silakan login kembali.",
  WAJIB_GANTI_PASSWORD: "Anda harus mengganti password terlebih dahulu.",
  TIDAK_DIIZINKAN: "Anda tidak memiliki akses untuk aksi ini.",
  KREDENSIAL_SALAH: "ID atau password salah.",
  TERLALU_BANYAK_PERCOBAAN: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.",
  VALIDASI_GAGAL: "Data yang dimasukkan belum benar. Periksa kembali isian Anda.",
  SERVER_ERROR: "Terjadi kesalahan di server. Coba lagi, dan hubungi admin jika berulang.",
  PASSWORD_LAMA_SALAH: "Password lama salah.",
  USERNAME_SUDAH_ADA: "ID tersebut sudah dipakai.",
  PENGGUNA_TIDAK_DITEMUKAN: "Pengguna tidak ditemukan.",
  TIDAK_BISA_NONAKTIFKAN_DIRI: "Anda tidak bisa menonaktifkan akun Anda sendiri.",
  TIDAK_BISA_HAPUS_DIRI: "Anda tidak bisa menghapus akun Anda sendiri.",
  AKUN_PUNYA_RIWAYAT: "Akun ini sudah punya riwayat. Gunakan Nonaktifkan.",
  SUPER_ADMIN_TERAKHIR: "Super admin terakhir tidak bisa dihapus.",
  NASABAH_TIDAK_DITEMUKAN: "Nasabah tidak ditemukan.",
  NASABAH_NONAKTIF: "Akun nasabah ini nonaktif.",
  JENIS_SAMPAH_TIDAK_VALID: "Jenis sampah tidak ada atau sudah dinonaktifkan.",
  FOTO_WAJIB: "Foto timbangan wajib dilampirkan.",
  FOTO_TIDAK_VALID: "Foto tidak valid. Gunakan JPG, PNG, atau WebP dengan ukuran wajar.",
  FOTO_SUDAH_DIPAKAI: "Foto ini sudah pernah dipakai pada transaksi lain. Ambil foto timbangan yang baru.",
  FOTO_TERLALU_BESAR: `Foto terlalu besar. Maksimal ${AVATAR_MAX_KB} KB.`,
  ITEM_TERLALU_KECIL: "Berat terlalu kecil sehingga nilainya Rp0. Periksa berat dan jenis sampah.",
  SALDO_TIDAK_CUKUP: "Saldo nasabah tidak cukup.",
  TRANSAKSI_TIDAK_DITEMUKAN: "Transaksi tidak ditemukan.",
  TRANSAKSI_SUDAH_DIBALIK: "Transaksi ini sudah pernah dikoreksi.",
  TRANSAKSI_TIDAK_BISA_DIBALIK: "Transaksi koreksi tidak bisa dikoreksi lagi.",
  KOREKSI_MEMBUAT_SALDO_MINUS: "Koreksi ini membuat saldo nasabah minus (uangnya kemungkinan sudah ditarik).",
};

/* ========================================================================== */
/* 4. BENTUK HASIL                                                             */
/* ========================================================================== */
/**
 * Semua query & action (kecuali getSesi) mengembalikan ActionResult.
 * Tidak ada throw untuk kegagalan yang diharapkan. Kegagalan tak terduga
 * dipetakan ke SERVER_ERROR (detail hanya di log server, tidak ke klien).
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ErrorCode;
      message: string;
      /** Hanya untuk VALIDASI_GAGAL. Kunci = path field ("items.0.berat"), "_form" bila tidak spesifik. */
      fieldErrors?: Record<string, string[]>;
      /** Hanya untuk TERLALU_BANYAK_PERCOBAAN. */
      retryAfterDetik?: number;
    };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  code: ErrorCode,
  extra?: { fieldErrors?: Record<string, string[]>; retryAfterDetik?: number },
): ActionResult<never> {
  return { ok: false, code, message: ERROR_MESSAGES[code], ...extra };
}

/** Ubah ZodError menjadi VALIDASI_GAGAL dengan fieldErrors per path. */
export function failDariZod(err: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail("VALIDASI_GAGAL", { fieldErrors });
}

/** Untuk halaman server: kembalikan path redirect jika error menuntutnya, selain itu null. */
export function redirectUntukError(code: ErrorCode): string | null {
  if (code === "TIDAK_LOGIN") return ROUTES.login;
  if (code === "WAJIB_GANTI_PASSWORD") return ROUTES.gantiPassword;
  return null;
}

/** Pesan dari DB (RAISE ... MESSAGE) -> kode error; selain itu SERVER_ERROR. */
export function kodeDariPesanDb(message: unknown): ErrorCode {
  return isErrorCode(message) && (DB_ERROR_CODES as readonly string[]).includes(message)
    ? message
    : "SERVER_ERROR";
}

/* ========================================================================== */
/* 5. HELPER UANG & BERAT (hanya integer, tanpa float untuk uang)              */
/* ========================================================================== */
/** "12.5" -> 1250 (sentikilogram). Asumsi string sudah lolos skema berat. */
export function beratKeCenti(berat: string): number {
  const [bulat, desimal = ""] = berat.split(".");
  return Number(bulat) * 100 + Number((desimal + "00").slice(0, 2));
}

/** "12.5" -> "12.50" */
export function normalisasiBerat(berat: string): BeratStr {
  const c = beratKeCenti(berat);
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`;
}

/**
 * PERKIRAAN subtotal untuk pratinjau di UI. Selalu beri label "Perkiraan".
 * Angka final yang disimpan/ditampilkan setelah submit berasal dari server.
 * Pembulatan sama dengan SQL round(numeric): setengah ke atas untuk nilai positif.
 */
export function estimasiSubtotal(berat: string, hargaPerKg: Rupiah): Rupiah {
  return Math.floor((beratKeCenti(berat) * hargaPerKg + 50) / 100);
}

export function formatRupiah(n: Rupiah): string {
  const abs = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}Rp${abs}`;
}

/* ========================================================================== */
/* 6. SKEMA INPUT (dipakai frontend untuk form DAN backend untuk validasi)     */
/* ========================================================================== */
const idStr = z.string().regex(/^\d{1,18}$/, "ID tidak valid");
const userId = z.string().min(1, "Wajib diisi").max(64);
const catatan = z.string().trim().max(LIMIT.CATATAN_MAKS, "Terlalu panjang").optional();
const uuid = z.uuid("clientRequestId harus UUID");

const beratInput = z
  .string()
  .regex(/^\d{1,5}(\.\d{1,2})?$/, "Format berat: angka, maksimal 2 desimal (contoh 12.5)")
  .refine((v) => beratKeCenti(v) > 0, "Berat harus lebih dari 0")
  .refine((v) => beratKeCenti(v) <= LIMIT.MAKS_BERAT_KG * 100, `Berat maksimal ${LIMIT.MAKS_BERAT_KG} kg`);

const passwordBaru = z
  .string()
  .min(LIMIT.PASSWORD_MIN, `Minimal ${LIMIT.PASSWORD_MIN} karakter`)
  .max(LIMIT.PASSWORD_MAKS);

// --- Auth ---
export const LoginInputSchema = z.object({
  username: z.string().trim().min(1, "Wajib diisi").max(64),
  password: z.string().min(1, "Wajib diisi").max(LIMIT.PASSWORD_MAKS),
});

export const GantiPasswordInputSchema = z
  .object({
    passwordLama: z.string().min(1, "Password saat ini wajib diisi").max(LIMIT.PASSWORD_MAKS),
    passwordBaru,
    konfirmasi: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((v) => v.passwordBaru === v.konfirmasi, {
    path: ["konfirmasi"],
    message: "Konfirmasi password baru tidak sama",
  })
  .refine((v) => v.passwordBaru !== v.passwordLama, {
    path: ["passwordBaru"],
    message: "Password baru tidak boleh sama dengan password saat ini",
  });

// --- Nama orang (pengguna) ---
/**
 * Kata kasar / pornografi yang tidak boleh ada di nama pengguna. Dicocokkan PER KATA (bukan
 * potongan kata) setelah normalisasi, supaya nama asli seperti "Dickson", "Hasudungan",
 * "Bobby", atau "Essex" tidak ikut ditolak.
 */
export const KATA_TERLARANG = [
  "anjing", "babi", "kontol", "memek", "jancok", "bangsat", "asu", "pantek", "ngentot", "puki",
  "tolol", "goblok", "sex", "porn", "bokep", "sange", "bo", "pussy", "dick", "fuck", "shit", "bitch",
] as const;

export const PESAN_NAMA_TERLARANG =
  "Nama mengandung kata-kata yang tidak sopan atau terlarang. Mohon gunakan nama yang pantas.";

/** Leet-speak sederhana -> huruf. */
const LEET: Record<string, string> = { "@": "a", "4": "a", "0": "o", $: "s", "5": "s", "!": "i", "1": "i", "3": "e", "7": "t" };
/** "anjiiing" -> "anjing": huruf berulang diringkas (diterapkan ke input DAN daftar). */
const ringkasUlang = (k: string) => k.replace(/(.)\1+/g, "$1");
const TERLARANG = new Set(KATA_TERLARANG.map(ringkasUlang));

/**
 * true bila nama memuat kata terlarang (tidak peka huruf besar/kecil). Menangani leet-speak
 * (@ 4 0 $ 5 ! 1 3 7), huruf berulang, dan huruf yang dipisah spasi/titik ("a n j i n g").
 */
export function mengandungKataTerlarang(nama: string): boolean {
  const normal = nama.toLowerCase().replace(/[@40$5!137]/g, (c) => LEET[c]);
  const potongan = normal.split(/[^\p{L}]+/u).filter(Boolean);
  // Huruf tunggal berurutan digabung: "a n j i n g" -> "anjing".
  const kata: string[] = [];
  let tunggal = "";
  for (const p of potongan) {
    if (p.length === 1) {
      tunggal += p;
      continue;
    }
    if (tunggal) kata.push(tunggal);
    tunggal = "";
    kata.push(p);
  }
  if (tunggal) kata.push(tunggal);
  return kata.some((k) => TERLARANG.has(ringkasUlang(k)));
}

/** Nama orang: 3-40 karakter; huruf, angka, spasi, titik, petik tunggal; tanpa kata terlarang. */
export const namaOrang = z
  .string()
  .trim()
  .min(3, "Minimal 3 karakter")
  .max(40, "Maksimal 40 karakter")
  .refine((v) => !mengandungKataTerlarang(v), PESAN_NAMA_TERLARANG)
  .regex(/^[\p{L}\p{N} .']+$/u, "Hanya boleh huruf, angka, spasi, titik (.), dan petik tunggal (')");

// --- Pengguna (Super Admin) ---
export const BuatPenggunaInputSchema = z.object({
  role: z.enum(["admin", "nasabah"]),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, "3–32 karakter: huruf kecil, angka, titik, garis bawah, strip"),
  nama: namaOrang,
});

export const ResetPasswordInputSchema = z.object({ userId });
export const SetStatusPenggunaInputSchema = z.object({ userId, aktif: z.boolean() });

/**
 * Hapus akun (koreksi salah tambah akun). `konfirmasi` harus sama PERSIS dengan ID (username) atau
 * nama akun target; dicocokkan di server terhadap data DB, bukan data dari klien.
 */
export const HapusPenggunaInputSchema = z.object({
  userId,
  konfirmasi: z.string().trim().min(1, "Ketik ID atau nama akun").max(64),
  alasan: z.string().trim().min(LIMIT.ALASAN_MIN, `Minimal ${LIMIT.ALASAN_MIN} karakter`).max(LIMIT.ALASAN_MAKS),
});

export const ListPenggunaInputSchema = z.object({
  search: z.string().trim().max(64).optional(),
  /** Filter role. Untuk admin diabaikan: server memaksa "nasabah". */
  role: z.enum(ROLES).optional(),
  /** Prefix RT, misal "01". Hanya relevan untuk nasabah (ID nasabah = RT 2 digit + nomor urut). */
  rt: z.string().trim().regex(/^\d{1,2}$/, "RT berupa 1-2 angka").optional(),
  aktif: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

/** ID nasabah = 2 digit RT + nomor urut 2 digit (contoh "0103"). */
export const GetLatestIdByRtInputSchema = z.object({
  rtNumber: z.string().trim().regex(/^\d{1,2}$/, "RT berupa 1-2 angka"),
});

// --- Nasabah & jenis sampah ---
export const CariNasabahInputSchema = z.object({
  query: z.string().trim().min(2, "Minimal 2 karakter").max(64),
});
export const GetNasabahInputSchema = z.object({ customerId: userId });

export const SimpanJenisSampahInputSchema = z.object({
  id: idStr.optional(), // kosong = buat baru
  nama: z.string().trim().min(2, "Terlalu pendek").max(60),
  hargaBeli: z.number().int().min(1).max(LIMIT.MAKS_HARGA_BELI_PER_KG),
  /** Harga jual ke lapak per kg. null = belum diatur; tidak dikirim = tidak diubah. */
  hargaJual: z.number().int().min(1).max(LIMIT.MAKS_HARGA_BELI_PER_KG).nullable().optional(),
  aktif: z.boolean(),
});

export const RiwayatHargaInputSchema = z.object({
  sampahId: idStr.optional(),
});

// --- Transaksi ---
export const SetorItemSchema = z.object({
  wasteTypeId: idStr,
  berat: beratInput,
});

export const SetorInputSchema = z.object({
  customerId: userId,
  items: z
    .array(SetorItemSchema)
    .min(1, "Minimal 1 jenis sampah")
    .max(LIMIT.MAKS_ITEM_PER_SETOR)
    .refine((xs) => new Set(xs.map((x) => x.wasteTypeId)).size === xs.length, "Jenis sampah tidak boleh dobel"),
  catatan,
  /** UUID dibuat SEKALI per form terbuka (crypto.randomUUID()), dipakai ulang saat "coba lagi". */
  clientRequestId: uuid,
});

export const TarikInputSchema = z.object({
  customerId: userId,
  /** POSITIF. Server yang mengubahnya jadi negatif di ledger. */
  jumlah: z.number().int("Harus bilangan bulat").min(1, "Minimal Rp1").max(LIMIT.MAKS_TARIK_RUPIAH),
  catatan,
  clientRequestId: uuid,
});

export const KoreksiInputSchema = z.object({
  transaksiId: idStr,
  alasan: z.string().trim().min(LIMIT.ALASAN_MIN, `Minimal ${LIMIT.ALASAN_MIN} karakter`).max(LIMIT.ALASAN_MAKS),
  clientRequestId: uuid,
});

/**
 * Penyesuaian saldo oleh admin/super_admin (misal saldo awal dari pencatatan manual, salah
 * hitung di luar sistem). Bukan "ubah angka saldo": ledger tetap append-only, penyesuaian
 * dicatat sebagai transaksi baru yang bisa diaudit dan dikoreksi.
 */
export const PenyesuaianInputSchema = z.object({
  customerId: userId,
  /** BERTANDA: positif menambah saldo, negatif mengurangi. Tidak boleh 0. */
  jumlah: z
    .number()
    .int("Harus bilangan bulat")
    .refine((v) => v !== 0, "Tidak boleh 0")
    .refine((v) => Math.abs(v) <= LIMIT.MAKS_TARIK_RUPIAH, `Maksimal Rp${LIMIT.MAKS_TARIK_RUPIAH.toLocaleString("id-ID")}`),
  alasan: z.string().trim().min(LIMIT.ALASAN_MIN, `Minimal ${LIMIT.ALASAN_MIN} karakter`).max(LIMIT.ALASAN_MAKS),
  clientRequestId: uuid,
});

export const HistoriInputSchema = z.object({
  customerId: userId,
  cursor: idStr.optional(),
  limit: z.number().int().min(1).max(LIMIT.HISTORI_MAKS).default(LIMIT.HISTORI_DEFAULT),
});

const tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD");
export const AuditInputSchema = z.object({
  adminId: userId.optional(),
  tipe: z.enum(TIPE_TRANSAKSI).optional(),
  /** Tanggal kalender zona Asia/Jakarta, inklusif. */
  dari: tanggal.optional(),
  sampai: tanggal.optional(),
  cursor: idStr.optional(),
  limit: z.number().int().min(1).max(LIMIT.HISTORI_MAKS).default(LIMIT.HISTORI_DEFAULT),
});
export const GetTransaksiInputSchema = z.object({ id: idStr });

/** Tipe untuk pemanggil = z.input (field ber-default boleh dikosongkan). */
export type LoginInput = z.input<typeof LoginInputSchema>;
export type GantiPasswordInput = z.input<typeof GantiPasswordInputSchema>;
export type BuatPenggunaInput = z.input<typeof BuatPenggunaInputSchema>;
export type ResetPasswordInput = z.input<typeof ResetPasswordInputSchema>;
export type SetStatusPenggunaInput = z.input<typeof SetStatusPenggunaInputSchema>;
export type HapusPenggunaInput = z.input<typeof HapusPenggunaInputSchema>;
export type ListPenggunaInput = z.input<typeof ListPenggunaInputSchema>;
export type GetLatestIdByRtInput = z.input<typeof GetLatestIdByRtInputSchema>;
export type RiwayatHargaInput = z.input<typeof RiwayatHargaInputSchema>;
export type CariNasabahInput = z.input<typeof CariNasabahInputSchema>;
export type GetNasabahInput = z.input<typeof GetNasabahInputSchema>;
export type SimpanJenisSampahInput = z.input<typeof SimpanJenisSampahInputSchema>;
export type SetorInput = z.input<typeof SetorInputSchema>;
export type TarikInput = z.input<typeof TarikInputSchema>;
export type KoreksiInput = z.input<typeof KoreksiInputSchema>;
export type PenyesuaianInput = z.input<typeof PenyesuaianInputSchema>;
export type HistoriInput = z.input<typeof HistoriInputSchema>;
export type AuditInput = z.input<typeof AuditInputSchema>;
export type GetTransaksiInput = z.input<typeof GetTransaksiInputSchema>;

/* ========================================================================== */
/* 7. FORM DATA UNTUK setor() (ada file, jadi bukan objek biasa)               */
/* ========================================================================== */
/**
 * setor() menerima FormData dengan tepat dua field:
 *   "payload": JSON string dari SetorInput
 *   "foto"   : File (sudah dikompres klien)
 * Frontend WAJIB memakai buildSetorFormData; backend WAJIB memakai parseSetorFormData.
 */
export function buildSetorFormData(input: SetorInput, foto: File): FormData {
  const fd = new FormData();
  fd.append("payload", JSON.stringify(input));
  fd.append("foto", foto);
  return fd;
}

export function parseSetorFormData(fd: FormData): { payload: unknown; foto: File | null } {
  const raw = fd.get("payload");
  let payload: unknown = null;
  if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }
  const foto = fd.get("foto");
  return { payload, foto: foto instanceof File && foto.size > 0 ? foto : null };
}

/**
 * unggahFotoProfil() menerima FormData: "foto" (File, sudah dikecilkan klien) dan opsional
 * "userId" (target; hanya super_admin untuk akun orang lain). Kosong = akun sendiri.
 */
export function buildFotoProfilFormData(foto: Blob, userId?: string): FormData {
  const fd = new FormData();
  fd.append("foto", foto, foto instanceof File ? foto.name : "foto");
  if (userId) fd.append("userId", userId);
  return fd;
}

export function parseFotoProfilFormData(fd: FormData): { foto: File | null; userId: string | undefined } {
  const foto = fd.get("foto");
  const userId = fd.get("userId");
  return {
    foto: foto instanceof File && foto.size > 0 ? foto : null,
    userId: typeof userId === "string" && userId.length > 0 && userId.length <= 64 ? userId : undefined,
  };
}

export const HapusFotoProfilInputSchema = z.object({ userId: userId.optional() });
export type HapusFotoProfilInput = z.input<typeof HapusFotoProfilInputSchema>;

/* ========================================================================== */
/* 8. DTO (bentuk data yang dikembalikan server)                               */
/* ========================================================================== */
export interface SesiInfo {
  userId: UserId;
  username: string;
  nama: string;
  role: Role;
  mustChangePassword: boolean;
  /** Versi foto profil sendiri (lihat urlFotoProfil); null = tanpa foto. */
  fotoVersi: string | null;
}

export interface PenggunaRingkas {
  id: UserId;
  username: string;
  nama: string;
  role: Role;
  aktif: boolean;
}

/** Pengguna lengkap untuk halaman kelola pengguna (cari + filter + halaman). */
export interface PenggunaDetail extends PenggunaRingkas {
  /** Prefix 2 digit RT dari ID nasabah. null untuk staf / ID tanpa prefix angka. */
  rt: string | null;
  mustChangePassword: boolean;
  createdAt: IsoUtc;
  /**
   * Hanya bermakna untuk super_admin (selain itu selalu false). false + alasan bila akun sudah punya
   * riwayat (transaksi sebagai nasabah/petugas, riwayat harga, log audit), akun sendiri, atau
   * super_admin terakhir. Server tetap mengecek ulang saat hapusPengguna.
   */
  bisaDihapus: boolean;
  alasanTidakBisaDihapus: ErrorCode | null;
  /** Versi foto profil (lihat urlFotoProfil); null = tanpa foto. */
  fotoVersi: string | null;
}

export interface HalamanPengguna {
  items: PenggunaDetail[];
  total: number;
  limit: number;
  offset: number;
}

export interface LatestIdByRtResult {
  /** ID nasabah berikutnya untuk RT ini, contoh "0103". */
  nextId: string;
  rt: string;
  /** Nomor urut tertinggi yang sudah dipakai di RT ini (0 bila belum ada). */
  count: number;
}

export interface NasabahRingkas {
  id: UserId;
  username: string; // "ID Nasabah"
  nama: string;
  aktif: boolean;
  saldo: Rupiah; // dihitung server = SUM(jumlah)
}

export interface RiwayatHargaTerakhir {
  waktu: IsoUtc;
  hargaLama: Rupiah;
  hargaBaru: Rupiah;
  diubahOlehNama: string;
}

export interface JenisSampah {
  id: IdStr;
  nama: string;
  hargaBeli: Rupiah; // per kg
  /** Harga jual ke lapak per kg. Hanya untuk admin & super_admin (nasabah: tidak ada); null = belum diatur. */
  hargaJual?: Rupiah | null;
  aktif: boolean;
  /** Perubahan harga beli terakhir (dari riwayat harga); null bila belum pernah. */
  terakhirDiubah?: RiwayatHargaTerakhir | null;
}

export interface RiwayatHargaItem {
  id: string;
  sampahId: IdStr;
  sampahNama: string;
  /** 0 = jenis sampah baru dibuat. */
  hargaLama: Rupiah;
  hargaBaru: Rupiah;
  diubahOlehId: UserId;
  diubahOlehNama: string;
  diubahOlehUsername: string;
  createdAt: IsoUtc;
}

export interface ItemTransaksi {
  wasteTypeId: IdStr;
  namaSampah: string;
  berat: BeratStr;
  hargaSnapshot: Rupiah; // harga saat transaksi, tidak berubah
  subtotal: Rupiah;
}

export interface TransaksiRingkas {
  id: IdStr;
  tipe: TipeTransaksi;
  /** Bertanda: setor +, tarik -, koreksi = kebalikan transaksi asli. */
  jumlah: Rupiah;
  waktu: IsoUtc;
  catatan: string | null; // untuk koreksi & penyesuaian = alasan
  dibuatOlehNama: string;
  /** true bila transaksi ini sudah dibalik oleh sebuah koreksi. */
  sudahDibalik: boolean;
  /** Hanya untuk tipe koreksi: id transaksi yang dibalik. */
  membalikId: IdStr | null;
}

export interface TransaksiDetail extends TransaksiRingkas {
  customerId: UserId;
  customerNama: string;
  customerUsername: string;
  dibuatOlehId: UserId;
  items: ItemTransaksi[]; // kosong untuk tarik & koreksi
  dibalikOlehId: IdStr | null; // id transaksi koreksi yang membalik ini
  /** URL bertanda tangan berumur pendek. Hanya diisi untuk super_admin & tipe setor; selain itu null. */
  fotoUrl: string | null;
  fotoUrlBerlakuHingga: IsoUtc | null;
}

export interface Halaman<T> {
  items: T[];
  /** Kirim balik sebagai `cursor` untuk halaman berikutnya; null = habis. */
  nextCursor: IdStr | null;
}

export interface MutasiResult {
  transaksi: TransaksiDetail;
  /** Saldo nasabah SETELAH transaksi, dari server. Jangan dihitung ulang di klien. */
  saldoBaru: Rupiah;
  /** true bila clientRequestId sudah pernah diproses; hasilnya adalah transaksi yang sama. */
  duplikat: boolean;
}

export interface PenggunaBaruResult {
  pengguna: PenggunaRingkas;
  /** Ditampilkan SATU KALI. Tidak bisa diambil lagi. Pengguna wajib menggantinya saat login pertama. */
  passwordSementara: string;
}

export interface ResetPasswordResult {
  passwordSementara: string;
}

export interface FotoProfilResult {
  userId: UserId;
  /** null = foto sudah dihapus (kembali ke inisial). */
  fotoVersi: string | null;
}

export interface HapusPenggunaResult {
  id: UserId;
  /** ID ini kosong lagi dan boleh dipakai ulang untuk akun baru. */
  username: string;
}

/* --- Aktivitas admin (streak login harian & presence) --- */

/** Tanggal kalender zona Asia/Jakarta, "YYYY-MM-DD". */
export type TanggalWib = string;

export interface StreakInfo {
  /** Hari berturut-turut sampai hari ini (atau kemarin, bila hari ini belum masuk). 0 = putus. */
  current: number;
  /** Rekor terpanjang sepanjang masa. */
  longest: number;
  sudahMasukHariIni: boolean;
  /** 7 hari terakhir, terlama dulu, hari ini paling akhir. */
  tujuhHari: { tanggal: TanggalWib; masuk: boolean }[];
}

export interface AnggotaTimAdmin {
  id: UserId;
  nama: string;
  username: string;
  role: "admin" | "super_admin";
  /** last_seen_at dalam PRESENCE.ONLINE_DETIK terakhir dan belum logout / tutup tab. */
  online: boolean;
  lastSeenAt: IsoUtc | null;
  fotoVersi: string | null;
  /**
   * Streak anggota ini. Diisi server HANYA untuk super_admin (semua anggota) atau untuk diri
   * sendiri (admin). Untuk admin lain selalu null: bukan disembunyikan UI, memang tidak dikirim.
   */
  streak: StreakInfo | null;
}

export interface AktivitasAdmin {
  /** Jam server; klien memakai ini (bukan jam perangkat) untuk jam WIB berjalan. */
  serverNow: IsoUtc;
  hariIni: TanggalWib;
  saya: StreakInfo;
  tim: AnggotaTimAdmin[];
}

/* ========================================================================== */
/* 9. ANTARMUKA API                                                            */
/* ========================================================================== */
/**
 * QUERY  = fungsi baca. Dipanggil dari Server Component / halaman server.
 *          Berkas implementasi: diawali `import "server-only"`.
 * ACTION = fungsi tulis. Server Action ("use server"), dipanggil dari
 *          Client Component (form, tombol).
 *
 * Implementasi mock (frontend) dan implementasi asli (backend) WAJIB
 * memenuhi antarmuka yang sama. Kesesuaian dicek compiler lewat
 * lib/api/conformance.ts. Kalau salah satu menyimpang, `tsc` gagal.
 */
export interface Queries {
  /** null = belum login. Satu-satunya fungsi yang tidak memakai ActionResult. */
  getSesi(): Promise<SesiInfo | null>;
  /** nasabah: profil & saldo sendiri. */
  getProfilSaya(): Promise<ActionResult<NasabahRingkas>>;
  /** admin, super_admin. Cocok dengan prefix username atau nama; maks 20 hasil. */
  cariNasabah(input: CariNasabahInput): Promise<ActionResult<NasabahRingkas[]>>;
  /** admin, super_admin. */
  getNasabah(input: GetNasabahInput): Promise<ActionResult<NasabahRingkas>>;
  /** Semua role (katalog harga). Default hanya aktif; admin & super_admin boleh termasukNonaktif. hargaJual hanya untuk staf. */
  listJenisSampah(input?: { termasukNonaktif?: boolean }): Promise<ActionResult<JenisSampah[]>>;
  /** super_admin. Riwayat perubahan harga beli, seluruh atau satu jenis sampah, terbaru dulu. */
  listRiwayatHarga(input?: RiwayatHargaInput): Promise<ActionResult<RiwayatHargaItem[]>>;
  /** super_admin. Daftar admin & super_admin (untuk filter audit & kelola pengguna). */
  listStaf(): Promise<ActionResult<PenggunaRingkas[]>>;
  /** admin, super_admin. Cari + filter + halaman. Admin hanya melihat nasabah (dipaksa di server). */
  listPengguna(input?: ListPenggunaInput): Promise<ActionResult<HalamanPengguna>>;
  /** nasabah: hanya miliknya (customerId diabaikan/harus sama). admin & super_admin: siapa saja. */
  getHistori(input: HistoriInput): Promise<ActionResult<Halaman<TransaksiRingkas>>>;
  /** nasabah: hanya miliknya. fotoUrl hanya untuk super_admin. */
  getTransaksi(input: GetTransaksiInput): Promise<ActionResult<TransaksiDetail>>;
  /** super_admin. Transaksi + item + foto berdampingan, terbaru dulu. */
  auditTransaksi(input: AuditInput): Promise<ActionResult<Halaman<TransaksiDetail>>>;
  /**
   * admin, super_admin. Streak sendiri + daftar Tim Admin dengan status aktif. Streak anggota lain
   * hanya untuk super_admin. Juga disajikan GET /api/admin/presence (dipolling dashboard).
   */
  getAktivitasAdmin(): Promise<ActionResult<AktivitasAdmin>>;
}

export interface Actions {
  login(input: LoginInput): Promise<ActionResult<SesiInfo>>;
  logout(): Promise<ActionResult<null>>;
  gantiPassword(input: GantiPasswordInput): Promise<ActionResult<null>>;

  /** super_admin: admin & nasabah. admin: hanya nasabah. */
  buatPengguna(input: BuatPenggunaInput): Promise<ActionResult<PenggunaBaruResult>>;
  /** admin, super_admin. ID nasabah berikutnya untuk satu RT (saran; buatPengguna tetap menolak duplikat). */
  getLatestIdByRt(input: GetLatestIdByRtInput): Promise<ActionResult<LatestIdByRtResult>>;
  /** super_admin. Menyetel mustChangePassword = true. */
  resetPasswordPengguna(input: ResetPasswordInput): Promise<ActionResult<ResetPasswordResult>>;
  /** super_admin. Tidak bisa menonaktifkan diri sendiri. */
  setStatusPengguna(input: SetStatusPenggunaInput): Promise<ActionResult<PenggunaRingkas>>;
  /**
   * super_admin. Hapus akun yang salah dibuat: hanya bila belum punya riwayat apa pun (saldo 0,
   * tanpa transaksi, tidak tercatat sebagai petugas/pelaku). Bukan diri sendiri, bukan super_admin
   * terakhir. Satu transaksi DB, syarat dicek ulang di dalamnya, dicatat di audit_akun.
   */
  hapusPengguna(input: HapusPenggunaInput): Promise<ActionResult<HapusPenggunaResult>>;
  /**
   * Semua role: foto profil sendiri. super_admin: juga akun orang lain (moderasi, FormData
   * "userId"). JPG/PNG/WebP, maks AVATAR.MAKS_KB, maks AVATAR.MAKS_DIMENSI px, dicek dari isi file;
   * server re-encode (EXIF/GPS dibuang). Maks AVATAR.MAKS_UNGGAH_PER_JAM per akun pengunggah.
   */
  unggahFotoProfil(formData: FormData): Promise<ActionResult<FotoProfilResult>>;
  /** Semua role: hapus foto sendiri (kembali ke inisial). super_admin: foto siapa pun. */
  hapusFotoProfil(input?: HapusFotoProfilInput): Promise<ActionResult<FotoProfilResult>>;
  /** admin, super_admin. Buat (tanpa id) atau ubah (dengan id). Perubahan harga hanya berlaku untuk transaksi berikutnya; perubahan harga beli dicatat di riwayat harga. */
  simpanJenisSampah(input: SimpanJenisSampahInput): Promise<ActionResult<JenisSampah>>;
  /** Sama dengan simpanJenisSampah (nama yang dipakai halaman katalog). */
  updateHargaSampah(input: SimpanJenisSampahInput): Promise<ActionResult<JenisSampah>>;

  /** admin, super_admin. Argumen = FormData, lihat buildSetorFormData. */
  setor(formData: FormData): Promise<ActionResult<MutasiResult>>;
  /** admin, super_admin. */
  tarik(input: TarikInput): Promise<ActionResult<MutasiResult>>;
  /** super_admin saja (Fase 1). */
  koreksi(input: KoreksiInput): Promise<ActionResult<MutasiResult>>;
  /** admin, super_admin. Tambah (+) / kurangi (-) saldo nasabah dengan alasan; saldo tidak boleh minus. */
  sesuaikanSaldo(input: PenyesuaianInput): Promise<ActionResult<MutasiResult>>;
}

/**
 * Matriks akses. Backend: pengecekan di setiap fungsi.
 * Frontend: hanya untuk menyembunyikan tombol/menu. Bukan keamanan.
 */
export const AKSES: Record<keyof Queries | keyof Actions, readonly Role[]> = {
  getSesi: ROLES,
  getProfilSaya: ["nasabah"],
  cariNasabah: ["admin", "super_admin"],
  getNasabah: ["admin", "super_admin"],
  listJenisSampah: ROLES,
  listRiwayatHarga: ["super_admin"],
  listStaf: ["super_admin"],
  listPengguna: ["admin", "super_admin"],
  getHistori: ROLES,
  getTransaksi: ROLES,
  auditTransaksi: ["super_admin"],
  getAktivitasAdmin: ["admin", "super_admin"],
  login: ROLES,
  logout: ROLES,
  gantiPassword: ROLES,
  buatPengguna: ["admin", "super_admin"],
  getLatestIdByRt: ["admin", "super_admin"],
  resetPasswordPengguna: ["super_admin"],
  setStatusPengguna: ["super_admin"],
  hapusPengguna: ["super_admin"],
  unggahFotoProfil: ROLES,
  hapusFotoProfil: ROLES,
  simpanJenisSampah: ["admin", "super_admin"],
  updateHargaSampah: ["admin", "super_admin"],
  setor: ["admin", "super_admin"],
  tarik: ["admin", "super_admin"],
  koreksi: ["super_admin"],
  sesuaikanSaldo: ["admin", "super_admin"],
};

/**
 * Aksi yang TETAP boleh dipanggil saat mustChangePassword = true.
 * Semua aksi lain harus mengembalikan WAJIB_GANTI_PASSWORD.
 */
export const BOLEH_SAAT_WAJIB_GANTI_PASSWORD = ["getSesi", "login", "logout", "gantiPassword"] as const;
