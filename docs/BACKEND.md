# Backend Bank Sampah — panduan frontend & serah terima

Backend memenuhi `contract/index.ts` (Kontrak v1.0). Semua fungsi `Queries` dan `Actions`
sudah ada di `server/api/` dan diperiksa compiler lewat `server/api/conformance.ts`.

## Peta file

| File | Isi |
|---|---|
| `server/api/actions.ts` | Server Actions (`"use server"`): login, logout, gantiPassword, buatPengguna, resetPasswordPengguna, setStatusPengguna, simpanJenisSampah, setor, tarik, koreksi |
| `server/api/real-actions.ts` | Objek `realActions: Actions` untuk saklar frontend (tanpa `server-only`, boleh diimpor Client Component) |
| `server/api/queries.ts` | Query (`server-only`): getSesi, getProfilSaya, cariNasabah, getNasabah, listJenisSampah, listStaf, getHistori, getTransaksi, auditTransaksi + objek `realQueries: Queries` |
| `server/api/conformance.ts` | Pemeriksaan tipe `Queries`/`Actions` (tsc saja) |
| `server/guards.ts` | `requireAkses(nama)`: urutan kontrak Bagian 8.1 |
| `server/auth.ts` | Konfigurasi Better Auth 1.7.6 |
| `server/foto/*` | Validasi foto, FotoStorage (local / supabase), route dev |
| `server/konfigurasi.ts` | Validasi env (zod) |
| `app/api/dev-foto/[name]/route.ts` | Route DEV foto lokal (satu-satunya file backend di `app/`) |
| `drizzle/` | Migration (lihat urutan di bawah) |

Setiap fungsi: `requireAkses` (sesi → wajib ganti password → AKSES, role dibaca dari DB tiap
request) → validasi zod kontrak (`failDariZod`) → logika → `ok()`/`fail()`. Kegagalan tak
terduga → `SERVER_ERROR`, detail hanya di log server. Tidak ada `throw` ke pemanggil.

## Membalik saklar mock → asli

Hanya dua file frontend yang berubah. **Path di komentar file saklar saat ini
(`@/src/server/api/...`) salah**: backend ada di `server/`, bukan `src/server/`, dan file
`"use server"` tidak boleh mengekspor objek.

`src/lib/api/actions.ts`:

```ts
import { realActions as a } from "@/server/api/real-actions";
```

`src/lib/api/queries.ts`:

```ts
import { realQueries as q } from "@/server/api/queries";
```

Setelah dibalik, perhatikan:

1. **Query hanya boleh dipanggil dari Server Component** (kontrak Bagian 9; `queries.ts`
   mengimpor `server-only`). Beberapa halaman `"use client"` sekarang memanggil `queries.*`
   langsung (misalnya `app/admin/page.tsx`, `app/admin/jenis-sampah/page.tsx`,
   `app/admin/pengguna/page.tsx`, `app/admin/nasabah/[id]/setor/page.tsx`,
   `.../tarik/page.tsx`, `app/ganti-password/page.tsx`). Setelah saklar dibalik, build akan
   gagal di halaman tersebut sampai datanya diambil di Server Component lalu dikirim sebagai
   props. Ini belum dicoba (saklar tidak saya ubah).
2. Ada dua salinan kontrak: `contract/index.ts` (dipakai backend, `@/contract`) dan
   `src/contract/index.ts` (dipakai frontend, `@/src/contract`). Isinya sekarang sama, tetapi
   bisa menyimpang. Sebaiknya disatukan lewat PR kontrak.
3. Perilaku mock berbeda dari asli: mock mengembalikan `TIDAK_DIIZINKAN` untuk login akun
   nonaktif, backend asli mengembalikan `KREDENSIAL_SALAH` (disengaja, lihat di bawah).

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
- Saldo tidak pernah minus; ledger append-only (UPDATE/DELETE/TRUNCATE ditolak trigger).
- `clientRequestId` sama → transaksi asli dikembalikan dengan `duplikat: true`, file foto
  kedua dihapus. UUID yang sama dipakai untuk operasi lain → `VALIDASI_GAGAL`.
- Foto: hanya JPEG/PNG/WebP yang isinya (magic bytes) cocok dengan tipe yang diklaim,
  maks 1,5 MB; foto yang sama tidak boleh dipakai dua kali kecuali transaksi pertamanya sudah
  dikoreksi. `fotoUrl` hanya untuk super_admin, berlaku 5 menit.
- Ganti password: password umum / berisi ID pengguna ditolak (`VALIDASI_GAGAL`,
  `fieldErrors.passwordBaru`); sesi lain dicabut, sesi saat ini tetap.
- Reset password & nonaktifkan pengguna menghapus SEMUA sesi pengguna itu.
- `listJenisSampah`: admin selalu hanya yang aktif; `termasukNonaktif` hanya untuk super_admin.
- `auditTransaksi`: `dari`/`sampai` = tanggal kalender Asia/Jakarta, inklusif.
- Handler HTTP Better Auth (`/api/auth/*`) TIDAK di-mount; semua auth lewat Server Action.

## BELUM TERUJI

- Supabase asli: migration, role `app_server` lewat Supavisor, RLS/policy, `pg_dump` di
  workflow backup, restore (`scripts/restore-backup.md`).
- Pembacaan IP di Vercel (`x-vercel-forwarded-for`), termasuk apakah header kiriman klien
  dibuang. Cara uji di preview deploy: login gagal dengan header palsu
  `x-vercel-forwarded-for: 203.0.113.9`, lalu `select ip from login_gagal_ip order by id desc`
  harus berisi IP asli.
- Cookie sesi di runtime Next.js sungguhan (tes memakai mock `next/headers`): atribut
  Secure/HttpOnly/SameSite di produksi, refresh sesi.
- FotoStorage Supabase (`server/foto/supabase.ts`): upload, hapus, signed URL.
- Build dengan saklar asli (lihat "Membalik saklar").
- Workflow CI dan backup belum pernah dijalankan di GitHub.
