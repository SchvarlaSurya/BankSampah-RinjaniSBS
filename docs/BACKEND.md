# Backend Bank Sampah — panduan frontend & serah terima

Backend memenuhi `contract/index.ts` (Kontrak v1.0). Semua fungsi `Queries` dan `Actions`
sudah ada di `server/api/` dan diperiksa compiler lewat `server/api/conformance.ts`.

## Peta file

| File | Isi |
|---|---|
| `server/api/actions.ts` | Server Actions (`"use server"`): login, logout, gantiPassword, buatPengguna, getLatestIdByRt, resetPasswordPengguna, setStatusPengguna, hapusPengguna, simpanJenisSampah, updateHargaSampah, setor, tarik, koreksi, sesuaikanSaldo |
| `server/api/real-actions.ts` | Objek `realActions: Actions` untuk saklar frontend (tanpa `server-only`, boleh diimpor Client Component) |
| `server/api/queries.ts` | Query (`server-only`): getSesi, getProfilSaya, cariNasabah, getNasabah, listJenisSampah, listRiwayatHarga, listStaf, listPengguna, getHistori, getTransaksi, auditTransaksi, getAktivitasAdmin + objek `realQueries: Queries` |
| `server/aktivitas-admin.ts` | Login harian (UPSERT `admin_login_day`), heartbeat/offline (`admin_presence`), data dashboard streak + Tim Admin, keepalive |
| `server/aktivitas-admin-route.ts` | Logika route `/api/admin/presence` (GET/POST) dan `/api/cron/keepalive` |
| `server/hapus-akun.ts` | Aturan & proses hapus akun (satu transaksi DB, cek ulang, log `audit_akun`) |
| `lib/streak.ts` | `computeStreak(tanggal[], hariIniWIB)` fungsi murni + `tanggalWib` |
| `server/api/conformance.ts` | Pemeriksaan tipe `Queries`/`Actions` (tsc saja) |
| `server/guards.ts` | `requireAkses(nama)`: urutan kontrak Bagian 8.1 |
| `server/auth.ts` | Konfigurasi Better Auth 1.7.6 |
| `server/foto/*` | Validasi foto, FotoStorage (local / supabase), route dev |
| `server/konfigurasi.ts` | Validasi env (zod) |
| `app/api/dev-foto/[name]/route.ts` | Route DEV foto lokal |
| `app/api/admin/presence/route.ts`, `app/api/cron/keepalive/route.ts` | Route presence admin & cron keepalive (memuat modul server secara dinamis) |
| `drizzle/` | Migration (lihat urutan di bawah) |

Setiap fungsi: `requireAkses` (sesi → wajib ganti password → AKSES, role dibaca dari DB tiap
request) → validasi zod kontrak (`failDariZod`) → logika → `ok()`/`fail()`. Kegagalan tak
terduga → `SERVER_ERROR`, detail hanya di log server. Tidak ada `throw` ke pemanggil.

## Membalik saklar mock → asli

Hanya dua file frontend yang berubah (repo tanpa folder `src/`; satu kontrak di
`contract/index.ts`, diimpor `@/contract`).

`lib/api/actions.ts`:

```ts
import { realActions as a } from "@/server/api/real-actions";
```

`lib/api/queries.ts`:

```ts
import { realQueries as q } from "@/server/api/queries";
```

Jangan arahkan ke `@/server/api/actions`: file `"use server"` tidak boleh mengekspor objek.

- **Query hanya dipanggil dari Server Component** (kontrak Bagian 9). Mock
  (`lib/api/mock/queries.ts`) juga mengimpor `server-only`, jadi `npm run build` sudah gagal
  bila Client Component mengimpor `queries`, baik saat mock maupun asli. Halaman membaca data
  di `page.tsx` (server) dan mengirimnya lewat props ke komponen form (`"use client"`).
- Mock action juga Server Action (`lib/api/mock/server-actions.ts`), store mock di
  `globalThis`, jadi query dan action mock melihat data yang sama.
- `lib/api/conformance.ts` memeriksa mock DAN asli terhadap `Queries`/`Actions`.

## Env var

Contoh lengkap di `.env.example`. Di produksi (Vercel) isi lewat Environment Variables.

| Variabel | Wajib | Fungsi | Contoh placeholder |
|---|---|---|---|
| `DATABASE_URL` | ya | Runtime server sebagai role `app_server` lewat Supavisor transaction mode (6543). Username `<role>.<project-ref>` | `postgresql://app_server.<ref>:<pw>@<pooler-host>:6543/postgres` |
| `DATABASE_URL_MIGRATE` | migrate | `drizzle-kit migrate` sebagai owner, koneksi langsung / session pooler (5432) | `postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres` |
| `BETTER_AUTH_SECRET` | ya | Kunci tanda tangan cookie sesi, ≥ 32 karakter | `<openssl rand -base64 32>` |
| `BETTER_AUTH_URL` | ya | URL publik aplikasi | `https://banksampah.example.id` |
| `TRUSTED_ORIGINS` | tidak | Origin tambahan, dipisah koma | `https://staging.example.id` |
| `FOTO_STORAGE` | tidak | `local` (dev/tes, default) atau `supabase` (WAJIB di produksi) | `supabase` |
| `FOTO_LOCAL_DIR` | tidak | Folder foto untuk `local` (default `.data/foto`, sudah di .gitignore) | `.data/foto` |
| `SUPABASE_URL` | bila supabase | URL proyek Supabase (Storage) | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | bila supabase | Kunci service role, HANYA di server, jangan `NEXT_PUBLIC_` | `<service-role-key>` |
| `FOTO_BUCKET` | tidak | Nama bucket PRIVATE (default `foto-timbangan`) | `foto-timbangan` |
| `CRON_SECRET` | tidak | Rahasia `GET /api/cron/keepalive` (header `Authorization: Bearer ...`; Vercel Cron mengirimnya otomatis). Kosong = endpoint 503 | `<acak-minimal-16-karakter>` |
| `SEED_SUPERADMIN_USERNAME` / `SEED_SUPERADMIN_NAMA` | seed | Untuk `npm run seed:superadmin` | `kepala` / `Kepala Bank Sampah` |
| `RESET_SUPERADMIN_USERNAME` | reset | Untuk `npm run reset:superadmin` | `kepala` |

Tes **tidak** membaca env di atas: hanya `TEST_DATABASE_URL_OWNER` / `TEST_DATABASE_URL_APP`
(default Docker lokal, port 54329), dan abort bila host bukan localhost:54329.

Secret GitHub Actions (hanya workflow backup): `SUPABASE_DB_URL` (owner, 5432) dan
`BACKUP_AGE_RECIPIENT` (public key age). CI untuk PR tidak memakai secret.

## Menyiapkan database baru (Supabase)

1. `DATABASE_URL_MIGRATE=... npm run db:migrate` — menjalankan migration berurutan:
   1. `20260930130205_init` — tabel (dari `server/db/schema.ts` + `auth-schema.ts`)
   2. `20260930130209_roles_privileges_rls` — role `app_server`, cabut hak anon/authenticated, GRANT, RLS + policy
   3. `20260930130213_ledger_integrity` — view `saldo_nasabah`, trigger immutability, cek item deferred
   4. `20260930130217_ledger_functions` — fungsi `setor`, `tarik`, `koreksi`, `cek_request_ulang`
   5. `20260930161241_login_limiter` — tabel pembatas login
   6. `20260930161244_login_limiter_akses` — GRANT + RLS tabel pembatas login
   7. `20261001125555_login_limiter_bersih` — index waktu untuk pembersihan
   8. `20261009014811_abnormal_mauler` — (branch Kaywam) CHECK setor: foto boleh kosong di DB; action `setor` tetap mewajibkan foto
   9. `20261009033635_peaceful_shen` — (branch Kaywam) tabel `price_history`
   10. `20261009070504_cooing_argent` — (branch Kaywam) kolom `waste_types.harga_jual`
   11. `20261014013750_price_history_akses` — GRANT SELECT/INSERT + RLS `price_history` untuk app_server
   12. `20261014023416_penyesuaian_skema` — tipe transaksi `penyesuaian` + CHECK (alasan wajib, tanpa foto/reverses_id)
   13. `20261014023437_penyesuaian_fungsi` — fungsi SQL `penyesuaian` (EXECUTE hanya app_server)
   14. `20261111020325_aktivitas_admin` — tabel `admin_login_day`, `admin_presence`, `system_keepalive`
   15. `20261111020357_aktivitas_admin_akses` — GRANT + RLS tabel aktivitas admin
   16. `20261111022100_audit_akun` — tabel log `audit_akun` (hapus akun)
   17. `20261111022107_audit_akun_akses` — GRANT SELECT/INSERT (append-only) + RLS `audit_akun`
   Migration pertama ke Supabase membekukan riwayat: setelah itu perubahan hanya lewat migration BARU.
2. Set password `app_server` (tidak ada di migration): konek sebagai `postgres` dengan psql lalu
   `\password app_server`, isi `DATABASE_URL` dengan username `app_server.<project-ref>`.
3. Buat bucket Storage PRIVATE `foto-timbangan` (atau sesuai `FOTO_BUCKET`).
4. `npm run seed:superadmin` (lihat bawah).

## Seed & reset password super_admin

```bash
SEED_SUPERADMIN_USERNAME=kepala SEED_SUPERADMIN_NAMA="Kepala Bank Sampah" npm run seed:superadmin
```

Membuat super_admin pertama, mencetak password sementara SEKALI (10 karakter, tanpa 0/O/1/l/I),
`mustChangePassword = true`. Gagal bila sudah ada super_admin atau username terpakai. Tidak ada
jalur registrasi lain; pengguna berikutnya dibuat super_admin lewat `buatPengguna`.

```bash
RESET_SUPERADMIN_USERNAME=kepala npm run reset:superadmin
```

Darurat (super_admin lupa password): password sementara baru dicetak sekali, semua sesi
dicabut, kunci login dibuka, wajib ganti password. Hanya untuk super_admin aktif.

Kedua skrip membaca env dari `.env.local` / `.env` bila ada.

## Master jenis sampah dari Excel

`data/jenis-sampah-2026-09.json` = sheet REKAP dari "2026 09 September 20 master BSIP dan lapak.xlsx"
(85 jenis; `hargaSbs` = harga beli dari nasabah, `hargaLapak` & `kategori` belum disimpan di DB).

```bash
npm run seed:jenis-sampah              # rencana saja, tidak menulis
npm run seed:jenis-sampah -- --tulis   # tulis jenis yang belum ada
```

Hanya satuan Kg (57 jenis); Unit/Pcs/Galon/Liter (28) menunggu keputusan kontrak satuan.
Dicocokkan per nama (tanpa beda besar-kecil); jenis yang sudah ada tidak diubah, selisih harga
hanya dilaporkan. Memakai `DATABASE_URL` (role app_server cukup). Mock memuat file yang sama.

## Menjalankan tes

```bash
npm run test:db
```

Butuh Docker. Mereset Postgres lokal (`docker compose down/up`), menjalankan semua migration
dari nol, lalu vitest (`tests/db` untuk SQL, `tests/server` untuk lapisan action/query dengan
`next/headers` di-mock). Tidak pernah menyentuh Supabase. `npm run typecheck` memeriksa app
dan tes.

## Perilaku yang disengaja

- **Kunci login per username: 5 gagal / 15 menit** → `TERLALU_BANYAK_PERCOBAAN` +
  `retryAfterDetik`, berlaku walau password benar. Password lama yang salah di
  `gantiPassword` ikut dihitung. Konsekuensi: orang lain bisa mengunci akun seseorang selama
  15 menit. Super_admin membuka kunci dengan reset password.
- **Kunci per IP: 30 gagal / 15 menit**, IP dari `x-vercel-forwarded-for` saja.
  **Deploy harus di Vercel**: di luar Vercel header itu bisa dipalsukan klien (limiter per
  username tetap berlaku). Tanpa header (dev lokal) limiter per IP dilewati.
- Login gagal karena username tidak ada, password salah, atau akun nonaktif → semuanya
  `KREDENSIAL_SALAH` dengan waktu respons setara.
- **Nasabah nonaktif boleh ditarik** (sisa saldo hak nasabah); setor tetap wajib aktif.
- **Koreksi hanya super_admin** (Fase 1), dicek di guard DAN di fungsi SQL.
- **Penyesuaian saldo** (`sesuaikanSaldo`, admin & super_admin): saldo TIDAK diubah langsung;
  dicatat sebagai transaksi `penyesuaian` bertanda (+/-) dengan alasan wajib, lewat fungsi SQL
  `penyesuaian` (kunci baris nasabah seperti tarik). Penyesuaian negatif yang membuat saldo minus
  -> `SALDO_TIDAK_CUKUP`. Maks Rp100.000.000 per penyesuaian. Bisa dibalik super_admin lewat
  koreksi. Nasabah nonaktif tetap boleh disesuaikan.
- **Nama pengguna**: 3-40 karakter (huruf, angka, spasi, `.`, `'`), tanpa kata di
  `KATA_TERLARANG` (dicocokkan per kata utuh, termasuk leet-speak & huruf dipisah).
- Saldo tidak pernah minus; ledger append-only (UPDATE/DELETE/TRUNCATE ditolak trigger).
- `clientRequestId` sama → transaksi asli dikembalikan dengan `duplikat: true`, file foto
  kedua dihapus. UUID yang sama dipakai untuk operasi lain → `VALIDASI_GAGAL`.
- Foto: hanya JPEG/PNG/WebP yang isinya (magic bytes) cocok dengan tipe yang diklaim,
  maks 1,5 MB; foto yang sama tidak boleh dipakai dua kali kecuali transaksi pertamanya sudah
  dikoreksi. `fotoUrl` hanya untuk super_admin, berlaku 5 menit.
- Ganti password: password umum / berisi ID pengguna ditolak (`VALIDASI_GAGAL`,
  `fieldErrors.passwordBaru`); sesi lain dicabut, sesi saat ini tetap.
- Reset password & nonaktifkan pengguna menghapus SEMUA sesi pengguna itu.
- `listJenisSampah`: semua role (katalog). Default hanya aktif; `termasukNonaktif` hanya untuk
  staf. `hargaJual` hanya dikirim ke admin/super_admin (nasabah: field tidak ada).
- Admin boleh membuat **nasabah** (bukan admin) dan mengubah jenis sampah/harga. Setiap perubahan
  harga beli (dan pembuatan jenis baru, harga lama 0) dicatat di `price_history` (append-only);
  `listRiwayatHarga` hanya super_admin. `hargaJual` tidak dikirim = tidak diubah.
- `listPengguna`: admin selalu dipaksa ke role nasabah. RT = 2 digit pertama ID nasabah;
  `getLatestIdByRt` hanya saran ID berikutnya, `buatPengguna` tetap menolak duplikat.
- `auditTransaksi`: `dari`/`sampai` = tanggal kalender Asia/Jakarta, inklusif.
- Handler HTTP Better Auth (`/api/auth/*`) TIDAK di-mount; semua auth lewat Server Action.
- **Streak login harian** (admin & super_admin; nasabah tidak pernah dicatat): satu baris
  `admin_login_day` per (akun, tanggal WIB) lewat UPSERT. Dicatat oleh hook sesi Better Auth saat
  login berhasil DAN oleh heartbeat pertama hari itu (sesi bisa bertahan berhari-hari). Aturan
  streak di `lib/streak.ts`: hari terlewat = mulai lagi dari 1; hari ini belum masuk tapi kemarin
  masuk = belum putus. Admin biasa hanya menerima streak miliknya; streak orang lain `null` di
  payload (ditegakkan di `muatAktivitasAdmin`). Super_admin menerima streak semua staf.
- **Presence**: `POST /api/admin/presence` tiap 30 detik saat tab terlihat (`{status:"offline"}`
  lewat sendBeacon saat tab ditutup; logout juga menandai offline). Online = heartbeat ≤ 90 detik
  lalu dan belum offline. `GET` = data dashboard + `serverNow`, dipolling tiap 10 detik. 401/403
  menghentikan klien. POST dengan header Origin asing ditolak 403.
- **Hapus akun** (`hapusPengguna`, super_admin saja): untuk koreksi akun yang salah dibuat.
  Ditolak bila akun punya riwayat apa pun (`AKUN_PUNYA_RIWAYAT`: transaksi sebagai nasabah atau
  petugas, riwayat harga, atau pernah menjadi pelaku di `audit_akun`), akun sendiri
  (`TIDAK_BISA_HAPUS_DIRI`), atau super_admin aktif terakhir (`SUPER_ADMIN_TERAKHIR`). Wajib
  `konfirmasi` = ID atau nama persis dan `alasan`. Satu transaksi DB: baris target `FOR UPDATE`,
  syarat dicek ulang, FK ke `user` jadi pengaman terakhir (23503 → `AKUN_PUNYA_RIWAYAT`). Yang
  dihapus: user, account, session, admin_login_day, admin_presence, kunci login per-username.
  `audit_akun` (append-only) menyimpan pelaku, waktu, ID, nama, peran, alasan; tetap ada setelah
  akun terhapus. ID yang dihapus kosong lagi dan boleh dipakai ulang. `listPengguna` mengirim
  `bisaDihapus` + `alasanTidakBisaDihapus` untuk super_admin (tombol nonaktif + penjelasan).
- **Keepalive**: `GET /api/cron/keepalive` (Bearer `CRON_SECRET`) meng-UPSERT `system_keepalive`
  supaya database Supabase gratis selalu punya perubahan harian walau tidak ada admin login.
  Dijadwalkan `vercel.json` 23:00 UTC (06:00 WIB). Set `CRON_SECRET` di Vercel.

## BELUM TERUJI

- Supabase asli: migration, role `app_server` lewat Supavisor, RLS/policy, `pg_dump` di
  workflow backup. Restore TERUJI di Docker lokal (`scripts/restore-backup.md`), WAJIB diikuti
  `scripts/pasca-restore-hak-akses.sql`; restore ke Supabase belum diuji.
- Pembacaan IP di Vercel (`x-vercel-forwarded-for`), termasuk apakah header kiriman klien
  dibuang. Cara uji di preview deploy: login gagal dengan header palsu
  `x-vercel-forwarded-for: 203.0.113.9`, lalu `select ip from login_gagal_ip order by id desc`
  harus berisi IP asli.
- Cookie sesi di runtime Next.js sungguhan (tes memakai mock `next/headers`): atribut
  Secure/HttpOnly/SameSite di produksi, refresh sesi.
- FotoStorage Supabase (`server/foto/supabase.ts`): upload, hapus, signed URL.
- Build dengan saklar asli (lihat "Membalik saklar").
- Workflow CI dan backup belum pernah dijalankan di GitHub.
