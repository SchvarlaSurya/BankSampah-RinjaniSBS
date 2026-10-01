# Restore backup database ke Postgres lokal (Docker)

> **BELUM TERUJI terhadap Supabase.** Langkah `pg_restore` di bawah juga belum pernah
> dijalankan terhadap Postgres lokal; jalankan sekali sebagai latihan sebelum benar-benar
> dibutuhkan, lalu perbarui dokumen ini dengan hasilnya.

Backup dibuat oleh `.github/workflows/backup.yml` (harian 02:00 WIB atau dipicu manual):
`pg_dump --format=custom --no-owner --no-privileges --schema=public --schema=drizzle`,
langsung dienkripsi dengan [age](https://age-encryption.org) ke public key di secret
`BACKUP_AGE_RECIPIENT`, disimpan sebagai artifact `backup-db-<run_id>` selama 14 hari.
Ringkasan angka (jumlah baris, total saldo) ada di "Summary" job backup tersebut.

Yang dibutuhkan: Docker, `age`, file private key age (`kunci-backup.txt`, disimpan di luar
GitHub, misalnya di password manager), dan repo ini.

## 1. Unduh dan dekripsi

1. GitHub → Actions → **Backup DB** → pilih run → bagian *Artifacts* → unduh `backup-db-<run_id>`
   lalu ekstrak zip-nya. Isinya satu file `bank-sampah-<waktu>.dump.age`.
2. Dekripsi (plaintext berisi data nasabah: simpan di folder sementara, hapus setelah selesai):

   ```bash
   age --decrypt --identity kunci-backup.txt --output backup.dump bank-sampah-<waktu>.dump.age
   ```

## 2. Siapkan Postgres lokal

Pakai container dari `docker-compose.yml` (data di tmpfs, hilang saat `down`). Init script
`docker/postgres/init/01-supabase-roles.sql` membuat role `anon` dan `authenticated`.

```bash
docker compose down
docker compose up -d --wait db
```

Policy RLS di dump menyebut role `app_server`, jadi role itu harus ada sebelum restore.
Restore ke database baru `restore_tes` supaya tidak bercampur dengan hasil migration:

```bash
docker compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'app_server') then create role app_server login; end if; end \$\$;"
docker compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 -c "create database restore_tes"
```

## 3. Restore

```bash
docker compose exec -T db pg_restore -U postgres -d restore_tes --no-owner --no-privileges --clean --if-exists --single-transaction --exit-on-error < backup.dump
```

- `--single-transaction`: gagal di tengah = tidak ada yang tertinggal setengah jadi.
- Trigger (immutability, cek item deferred) dibuat SETELAH data dimuat (bagian post-data),
  jadi pemuatan data tidak terhalang trigger.
- Image `postgres:17-alpine` membawa `pg_restore` 17, sama dengan `pg_dump` di workflow.

## 4. Verifikasi

Bandingkan dengan ringkasan di Summary job backup (angka diambil sesaat sesudah dump; bila
ada transaksi tepat pada jam backup, selisih kecil masih mungkin).

```bash
docker compose exec -T db psql -U postgres -d restore_tes -X -c "
  select 'user' as tabel, count(*) from public.\"user\"
  union all select 'waste_types', count(*) from public.waste_types
  union all select 'transactions', count(*) from public.transactions
  union all select 'transaction_items', count(*) from public.transaction_items;"

docker compose exec -T db psql -U postgres -d restore_tes -X -c "
  select coalesce(sum(saldo), 0) as total_saldo, count(*) filter (where saldo < 0) as saldo_minus
  from public.saldo_nasabah;"
```

Lulus bila:

1. Jumlah baris keempat tabel sama dengan ringkasan backup.
2. `total_saldo` sama dengan ringkasan backup, dan `saldo_minus` = 0.
3. Ledger konsisten dengan view:

   ```bash
   docker compose exec -T db psql -U postgres -d restore_tes -X -c "
     select (select coalesce(sum(jumlah), 0) from public.transactions) as sum_ledger,
            (select coalesce(sum(saldo), 0) from public.saldo_nasabah) as sum_view;"
   ```

   Kedua kolom harus sama.
4. Setiap setor punya item dan totalnya cocok (harus 0 baris):

   ```bash
   docker compose exec -T db psql -U postgres -d restore_tes -X -c "
     select t.id from public.transactions t
     left join public.transaction_items i on i.transaction_id = t.id
     where t.tipe = 'setor'
     group by t.id, t.jumlah
     having coalesce(sum(i.subtotal), 0) <> t.jumlah;"
   ```
5. Migration terakhir tercatat:
   `select name from drizzle.__drizzle_migrations order by id desc limit 1;`

## 5. Bersihkan

```bash
docker compose down
rm backup.dump
```

## Catatan

- Dump TIDAK berisi role, password, maupun GRANT (`--no-owner --no-privileges`). Restore ini
  untuk memverifikasi data. Untuk menjalankan aplikasi di atas hasil restore, GRANT ke
  `app_server` perlu dibuat ulang (lihat migration `*_roles_privileges_rls`,
  `*_ledger_integrity`, `*_ledger_functions`, `*_login_limiter_akses`).
- Foto timbangan di Supabase Storage TIDAK ikut backup ini.
