import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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
    aktif: boolean("aktif").notNull().default(true),
  },
  (t) => [
    check("waste_types_harga_beli_positif", sql`${t.hargaBeli} > 0`),
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
    tipe: text("tipe", { enum: ["setor", "tarik", "koreksi"] }).notNull(),
    // Bertanda: setor +, tarik -, koreksi = -jumlah transaksi asli.
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
  },
  (t) => [
    foreignKey({
      name: "transactions_reverses_id_fkey",
      columns: [t.reversesId],
      foreignColumns: [t.id],
    }),
    check(
      "transactions_tipe_valid",
      sql`${t.tipe} IN ('setor', 'tarik', 'koreksi')`,
    ),
    check("transactions_jumlah_bukan_nol", sql`${t.jumlah} <> 0`),
    check(
      "transactions_setor_valid",
      sql`${t.tipe} <> 'setor' OR (
        ${t.jumlah} > 0
        AND ${t.reversesId} IS NULL
        AND ${t.pathFoto} IS NOT NULL
        AND ${t.hashFoto} IS NOT NULL
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
    // Bukan UNIQUE: hash boleh dipakai ulang setelah setor sebelumnya dibalik.
    // Keunikan "hash aktif" dijaga fungsi setor() dengan advisory lock.
    index("transactions_hash_foto_idx").on(t.hashFoto),
    index("transactions_customer_id_idx").on(t.customerId),
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
