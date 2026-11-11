import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

// Uang = integer rupiah, berat = numeric. Tidak ada kolom saldo:
// saldo selalu dihitung dari SUM(transactions.jumlah).

export const wasteTypes = pgTable(
  "waste_types",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    nama: text("nama").notNull(),
    hargaBeli: integer("harga_beli").notNull(),
    /** Harga jual ke lapak/pengepul. NULL = belum diatur (admin bisa set manual). */
    hargaJual: integer("harga_jual"),
    aktif: boolean("aktif").notNull().default(true),
  },
  (t) => [
    check("waste_types_harga_beli_positif", sql`${t.hargaBeli} > 0`),
    check("waste_types_harga_jual_positif", sql`${t.hargaJual} IS NULL OR ${t.hargaJual} > 0`),
    uniqueIndex("waste_types_nama_unique").on(sql`lower(btrim(${t.nama}))`),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    customerId: text("customer_id")
      .notNull()
      .references(() => user.id),
    tipe: text("tipe", { enum: ["setor", "tarik", "koreksi", "penyesuaian"] }).notNull(),
    // Bertanda: setor +, tarik -, koreksi = -jumlah transaksi asli, penyesuaian = + atau -.
    jumlah: integer("jumlah").notNull(),
    dibuatOleh: text("dibuat_oleh")
      .notNull()
      .references(() => user.id),
    waktu: timestamp("waktu", { withTimezone: true }).notNull().defaultNow(),
    catatan: text("catatan"),
    reversesId: bigint("reverses_id", { mode: "number" }).unique(
      "transactions_reverses_id_unique",
    ),
    pathFoto: text("path_foto"),
    hashFoto: text("hash_foto"),
    // Idempotency key dari klien (contract: clientRequestId). Retry dengan UUID
    // yang sama mengembalikan transaksi asli, bukan membuat transaksi baru.
    clientRequestId: uuid("client_request_id")
      .notNull()
      .unique("transactions_client_request_id_unique"),
  },
  (t) => [
    foreignKey({
      name: "transactions_reverses_id_fkey",
      columns: [t.reversesId],
      foreignColumns: [t.id],
    }),
    check(
      "transactions_tipe_valid",
      sql`${t.tipe} IN ('setor', 'tarik', 'koreksi', 'penyesuaian')`,
    ),
    check("transactions_jumlah_bukan_nol", sql`${t.jumlah} <> 0`),
    check(
      "transactions_setor_valid",
      sql`${t.tipe} <> 'setor' OR (
        ${t.jumlah} > 0
        AND ${t.reversesId} IS NULL
        AND (
          (${t.pathFoto} IS NULL AND ${t.hashFoto} IS NULL)
          OR (${t.pathFoto} IS NOT NULL AND ${t.hashFoto} IS NOT NULL)
        )
      )`,
    ),
    check(
      "transactions_tarik_valid",
      sql`${t.tipe} <> 'tarik' OR (${t.jumlah} < 0 AND ${t.reversesId} IS NULL)`,
    ),
    check(
      "transactions_koreksi_valid",
      sql`${t.tipe} <> 'koreksi' OR (
        ${t.reversesId} IS NOT NULL
        AND ${t.catatan} IS NOT NULL
        AND btrim(${t.catatan}) <> ''
      )`,
    ),
    check(
      "transactions_penyesuaian_valid",
      sql`${t.tipe} <> 'penyesuaian' OR (
        ${t.reversesId} IS NULL
        AND ${t.pathFoto} IS NULL
        AND ${t.hashFoto} IS NULL
        AND ${t.catatan} IS NOT NULL
        AND btrim(${t.catatan}) <> ''
      )`,
    ),
    // Bukan UNIQUE: hash boleh dipakai ulang setelah setor sebelumnya dibalik.
    // Keunikan "hash aktif" dijaga fungsi setor() dengan advisory lock.
    index("transactions_hash_foto_idx").on(t.hashFoto),
    // Histori per nasabah & audit super_admin, terbaru dulu (cursor = id).
    index("transactions_customer_id_id_idx").on(t.customerId, t.id.desc().nullsFirst()),
    index("transactions_dibuat_oleh_id_idx").on(t.dibuatOleh, t.id.desc().nullsFirst()),
    index("transactions_waktu_idx").on(t.waktu.desc().nullsFirst()),
  ],
);

export const transactionItems = pgTable(
  "transaction_items",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    transactionId: bigint("transaction_id", { mode: "number" })
      .notNull()
      .references(() => transactions.id),
    wasteTypeId: bigint("waste_type_id", { mode: "number" })
      .notNull()
      .references(() => wasteTypes.id),
    berat: numeric("berat", { precision: 10, scale: 2 }).notNull(),
    hargaSnapshot: integer("harga_snapshot").notNull(),
    subtotal: integer("subtotal").notNull(),
  },
  (t) => [
    check("transaction_items_berat_positif", sql`${t.berat} > 0`),
    check(
      "transaction_items_harga_snapshot_positif",
      sql`${t.hargaSnapshot} > 0`,
    ),
    check("transaction_items_subtotal_positif", sql`${t.subtotal} > 0`),
    check(
      "transaction_items_subtotal_konsisten",
      sql`${t.subtotal} = round(${t.berat} * ${t.hargaSnapshot})`,
    ),
    index("transaction_items_transaction_id_idx").on(t.transactionId),
  ],
);

// Pembatas login (diisi action login, bukan Better Auth). Satu baris = satu percobaan
// yang gagal / sedang berjalan dalam jendela 15 menit; login sukses menghapus barisnya.

export const loginGagalUsername = pgTable(
  "login_gagal_username",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    username: text("username").notNull(),
    waktu: timestamp("waktu", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("login_gagal_username_username_waktu_idx").on(
      t.username,
      t.waktu.desc().nullsFirst(),
    ),
    index("login_gagal_username_waktu_idx").on(t.waktu),
  ],
);

export const loginGagalIp = pgTable(
  "login_gagal_ip",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    ip: text("ip").notNull(),
    waktu: timestamp("waktu", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("login_gagal_ip_ip_waktu_idx").on(t.ip, t.waktu.desc().nullsFirst()),
    index("login_gagal_ip_waktu_idx").on(t.waktu),
  ],
);

export const priceHistory = pgTable(
  "price_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sampahId: bigint("sampah_id", { mode: "number" })
      .notNull()
      .references(() => wasteTypes.id, { onDelete: "cascade" }),
    hargaLama: integer("harga_lama").notNull(),
    hargaBaru: integer("harga_baru").notNull(),
    diubahOleh: text("diubah_oleh")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("price_history_sampah_id_idx").on(
      t.sampahId,
      t.createdAt.desc().nullsFirst(),
    ),
    index("price_history_created_at_idx").on(t.createdAt.desc().nullsFirst()),
    index("price_history_diubah_oleh_idx").on(t.diubahOleh),
  ],
);

// ─── Aktivitas admin (streak login harian, presence, keepalive) ─────────────
// Hanya admin & super_admin yang dicatat; nasabah tidak pernah. Baris ikut terhapus bersama
// akunnya (ON DELETE CASCADE): data ini bukan riwayat keuangan.

/** Satu baris per (admin, hari kalender Asia/Jakarta). Diisi lewat UPSERT, tidak pernah ganda. */
export const adminLoginDay = pgTable(
  "admin_login_day",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Tanggal kalender WIB (batas hari = tengah malam Asia/Jakarta). */
    loginDate: date("login_date", { mode: "string" }).notNull(),
    firstAt: timestamp("first_at", { withTimezone: true }).notNull().defaultNow(),
    lastAt: timestamp("last_at", { withTimezone: true }).notNull().defaultNow(),
    /** Jumlah login (sign-in) hari itu; aktivitas dengan sesi lama hanya memperbarui last_at. */
    count: integer("count").notNull().default(1),
  },
  (t) => [
    primaryKey({ name: "admin_login_day_pkey", columns: [t.userId, t.loginDate] }),
    check("admin_login_day_count_positif", sql`${t.count} >= 0`),
  ],
);

/** Siapa yang sedang aktif. online_since NULL = offline (logout / tab ditutup). */
export const adminPresence = pgTable("admin_presence", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  onlineSince: timestamp("online_since", { withTimezone: true }),
});

/**
 * Pengaman keepalive: cron harian menulis satu baris ini supaya database selalu punya perubahan
 * walau tidak ada admin yang login (Supabase gratis dijeda bila tidak aktif).
 */
export const systemKeepalive = pgTable(
  "system_keepalive",
  {
    id: smallint("id").primaryKey().default(1),
    lastPingAt: timestamp("last_ping_at", { withTimezone: true }).notNull().defaultNow(),
    jumlahPing: bigint("jumlah_ping", { mode: "number" }).notNull().default(1),
  },
  (t) => [check("system_keepalive_satu_baris", sql`${t.id} = 1`)],
);
