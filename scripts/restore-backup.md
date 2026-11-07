# Restore backup database ke Postgres lokal (Docker)

> **Status:** TERUJI di Docker lokal (2026-10-01: dump → age → container Postgres kosong →
> restore → verifikasi, semua langkah di bawah dijalankan apa adanya).
> **BELUM TERUJI di Supabase** (pg_dump dari Supabase asli, restore ke project Supabase).

Backup dibuat oleh `.github/workflows/backup.yml` (harian 02:00 WIB atau dipicu manual):
`pg_dump --format=custom --no-owner --no-privileges --schema=public --schema=drizzle`,
langsung dienkripsi dengan [age](https://age-encryption.org) ke public key di secret
`BACKUP_AGE_RECIPIENT`, disimpan sebagai artifact `backup-db-<run_id>` selama 14 hari.
Ringkasan angka (jumlah baris, total saldo) ada di "Summary" job backup tersebut.

Yang dibutuhkan: Docker, file private key age (`kunci-backup.txt`, disimpan di luar GitHub,
misalnya di password manager), dan repo ini. `age` tidak harus terpasang: perintah di bawah
menjalankannya di container `alpine`.

> **Windows (Git Bash):** awali perintah `docker run -v ...` dengan `MSYS_NO_PATHCONV=1` dan
> pakai path Windows (`$(pwd -W)`), kalau tidak Git Bash mengubah path di dalam argumen.

## 1. Unduh dan dekripsi

1. GitHub → Actions → **Backup DB** → pilih run → *Artifacts* → unduh `backup-db-<run_id>`,
   ekstrak zip-nya. Isinya satu file `bank-sampah-<waktu>.dump.age`.
2. Taruh file itu dan `kunci-backup.txt` di satu folder sementara DI LUAR repo, lalu dari folder
   itu dekripsi (plaintext berisi data nasabah, hapus setelah selesai):

   ```bash
   docker run --rm -v "$(pwd):/k" alpine:3.20 sh -c "apk add -q --no-progress age && age --decrypt --identity /k/kunci-backup.txt --output /k/backup.dump /k/bank-sampah-<waktu>.dump.age"
   head -c 5 backup.dump   # harus: PGDMP
   ```

## 2. Siapkan Postgres KOSONG

Container terpisah dari DB dev/tes (port 54330, data di tmpfs). Init script repo membuat role
`anon` dan `authenticated`. Jalankan dari root repo:

```bash
docker run -d --name restore-uji -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres \
  -p 54330:5432 --tmpfs /var/lib/postgresql/data \
  -v "$(pwd)/docker/postgres/init:/docker-entrypoint-initdb.d:ro" \
  --health-cmd "pg_isready -U postgres -d postgres" --health-interval 1s postgres:17-alpine
until [ "$(docker inspect -f '{{.State.Health.Status}}' restore-uji)" = healthy ]; do sleep 1; done
```

Role `app_server` (disebut policy RLS) dan database tujuan:

```bash
docker exec -i restore-uji psql -U postgres -v ON_ERROR_STOP=1 -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'app_server') then create role app_server login; end if; end \$\$;"
docker exec -i restore-uji psql -U postgres -v ON_ERROR_STOP=1 -c "create database restore_tes"
```

## 3. Restore + WAJIB pulihkan hak akses

```bash
docker exec -i restore-uji pg_restore -U postgres -d restore_tes --no-owner --no-privileges --clean --if-exists --single-transaction --exit-on-error < /path/ke/backup.dump
docker exec -i restore-uji psql -U postgres -d restore_tes -X < scripts/pasca-restore-hak-akses.sql
```

- `pg_restore` selesai tanpa error (exit 0). Trigger dibuat SETELAH data dimuat, jadi tidak
  menghalangi pemuatan.
- **`scripts/pasca-restore-hak-akses.sql` tidak boleh dilewati.** Masalah yang ditemukan saat
  uji: karena dump dibuat `--no-privileges`, semua GRANT/REVOKE hilang dan fungsi kembali ke
  default Postgres (EXECUTE untuk PUBLIC). Sebelum skrip dijalankan, `anon` dan
  `authenticated` BISA menjalankan `setor`/`tarik`/`koreksi` (SECURITY DEFINER, melewati RLS),
  sedangkan `app_server` tidak bisa SELECT apa pun. Skrip menerapkan ulang semua hak akses dari
  migration; setiap migration baru yang menambah GRANT/REVOKE harus ikut ditambahkan ke skrip.
- `--clean` membuat ulang schema `public` dengan owner `postgres` dan tanpa USAGE untuk
  PUBLIC/anon/authenticated (lebih ketat dari DB hasil migration). Untuk restore ke project
  Supabase, USAGE schema untuk role Supabase mungkin perlu diberikan lagi (belum diuji).

## 4. Verifikasi

Bandingkan dengan ringkasan di Summary job backup.

```bash
docker exec restore-uji psql -U postgres -d restore_tes -X -c "
  select 'user' as tabel, count(*) from public.\"user\"
  union all select 'waste_types', count(*) from public.waste_types
  union all select 'transactions', count(*) from public.transactions
  union all select 'transaction_items', count(*) from public.transaction_items;"

docker exec restore-uji psql -U postgres -d restore_tes -X -c "
  select (select coalesce(sum(jumlah), 0) from public.transactions) as sum_ledger,
         (select coalesce(sum(saldo), 0) from public.saldo_nasabah) as sum_view,
         (select count(*) from public.saldo_nasabah where saldo < 0) as saldo_minus;"

docker exec restore-uji psql -U postgres -d restore_tes -X -c "
  select t.id from public.transactions t
  left join public.transaction_items i on i.transaction_id = t.id
  where t.tipe = 'setor' group by t.id, t.jumlah
  having coalesce(sum(i.subtotal), 0) <> t.jumlah;"   # harus 0 baris

docker exec restore-uji psql -U postgres -d restore_tes -X -c "\df public.*" \
  -c "select tgrelid::regclass, tgname from pg_trigger where not tgisinternal order by 1, 2;" \
  -c "select r, has_function_privilege(r,'public.setor(text,text,uuid,jsonb,text,text,text)','EXECUTE') as exec_setor,
            has_table_privilege(r,'public.transactions','SELECT') as sel_trx
      from unnest(array['anon','authenticated','app_server']) r;"

docker exec -i restore-uji psql -U postgres -d restore_tes -X -c "begin; update public.transactions set jumlah = 1; rollback;"
```

Lulus bila: jumlah baris dan total saldo sama dengan ringkasan; `sum_ledger = sum_view`;
`saldo_minus = 0` (data asli selalu lewat fungsi SQL); query setor tanpa item 0 baris;
`\df` memuat `setor`, `tarik`, `koreksi`, `cek_request_ulang`, `tolak_perubahan_ledger`,
`cek_item_transaksi`; ada 6 trigger (`*_tolak_update_delete`, `*_tolak_truncate`, `*_cek_item`
pada `transactions` dan `transaction_items`); `anon`/`authenticated` = `f` di semua kolom,
`app_server` = `t`; UPDATE ditolak dengan "bersifat append-only".

### Hasil uji 2026-10-01 (Docker lokal)

Sumber: DB tes yang diisi skenario `tests/server/ledger.test.ts`, `baca-transaksi.test.ts`,
`tests/db/model.test.ts` (21 nasabah, 233 transaksi: 125 setor, 73 tarik, 35 koreksi).

- Jumlah baris 9 tabel (user 70, session 47, account 63, waste_types 25, transactions 233,
  transaction_items 217, login_gagal_* 0, `__drizzle_migrations` 7): identik.
- `SUM(jumlah)` dan jumlah transaksi per nasabah (21 nasabah): identik (`diff` kosong).
- `sum_ledger = sum_view = 1106292`. `saldo_minus = 1` sudah ada di SUMBER: tes audit menyisipkan
  baris tarik langsung sebagai owner untuk menguji batas tanggal, bukan efek restore.
- `\df`: 6 fungsi, `SECURITY DEFINER` + `search_path=""` utuh. 6 trigger utuh. RLS aktif di 9 tabel,
  policy `TO app_server` utuh.
- Setelah `pasca-restore-hak-akses.sql`: hak efektif 48 pasangan role × objek identik dengan DB
  hasil migration; anon/authenticated tanpa hak apa pun.
- Owner: UPDATE/DELETE/TRUNCATE `transactions` ditolak trigger. app_server: UPDATE/INSERT langsung
  ditolak (permission). anon: `tarik()` ditolak. app_server: `tarik()` jalan, tarik melebihi
  saldo → `SALDO_TIDAK_CUKUP`.

## 5. Bersihkan

```bash
docker rm -f restore-uji
rm backup.dump
```

## Catatan

- Dump TIDAK berisi role, password, maupun GRANT; role `app_server` dibuat tanpa password.
- Foto timbangan di Supabase Storage TIDAK ikut backup ini.
