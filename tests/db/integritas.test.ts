import { describe, expect, it } from "vitest";
import { bukaKoneksi, type Sql } from "./clients";
import { PERMISSION_DENIED, expectPgError } from "./errors";
import { buatKonteks, buatJenis, isiSaldo } from "./factories";
import { hashBaru, saldo, tarik, uuidBaru } from "./ledger";

const { owner, app } = bukaKoneksi();

const APPEND_ONLY = (tabel: string, op: string) =>
  `Tabel ${tabel} bersifat append-only: ${op} tidak diizinkan. Gunakan koreksi() untuk membalik transaksi.`;

/**
 * Jalankan statement berbahaya di dalam transaksi yang SELALU di-rollback. Kalau trigger
 * tidak bekerja dan statement sukses, datanya tidak ikut ter-commit.
 */
async function dalamRollback(sql: Sql, fn: (tx: Sql) => Promise<unknown>): Promise<unknown> {
  const BATAL = Symbol("batal");
  try {
    await sql.begin(async (tx) => {
      await fn(tx as unknown as Sql);
      throw BATAL;
    });
  } catch (e) {
    if (e === BATAL) throw new Error("Statement seharusnya gagal, ternyata sukses (sudah di-rollback).");
    throw e;
  }
  return undefined;
}

async function siapkanData() {
  const k = await buatKonteks(owner);
  const idSetor = await isiSaldo(app, k, 1_000);
  const t = await tarik(app, { customerId: k.nasabah, adminId: k.admin, jumlah: 100 });
  const [item] = await owner`select id::text from public.transaction_items where transaction_id = ${idSetor}`;
  return { k, idSetor, idTarik: t.transactionId, idItem: item.id as string };
}

describe("F. immutability", () => {
  it("owner: UPDATE / DELETE transactions & transaction_items ditolak trigger", async () => {
    const { k, idSetor, idItem } = await siapkanData();
    await expectPgError(dalamRollback(owner, (tx) => tx`update public.transactions set jumlah = 1 where id = ${idSetor}`), {
      message: APPEND_ONLY("transactions", "UPDATE"),
    });
    await expectPgError(dalamRollback(owner, (tx) => tx`delete from public.transactions where id = ${idSetor}`), {
      message: APPEND_ONLY("transactions", "DELETE"),
    });
    await expectPgError(
      dalamRollback(owner, (tx) => tx`update public.transaction_items set subtotal = 1, berat = 0.01 where id = ${idItem}`),
      { message: APPEND_ONLY("transaction_items", "UPDATE") },
    );
    await expectPgError(dalamRollback(owner, (tx) => tx`delete from public.transaction_items where id = ${idItem}`), {
      message: APPEND_ONLY("transaction_items", "DELETE"),
    });
    expect(await saldo(owner, k.nasabah)).toBe(900n);
  });

  it("owner: TRUNCATE transactions & transaction_items ditolak trigger", async () => {
    const { k } = await siapkanData();
    await expectPgError(dalamRollback(owner, (tx) => tx`truncate public.transaction_items`), {
      message: APPEND_ONLY("transaction_items", "TRUNCATE"),
    });
    // transactions direferensikan transaction_items, jadi keduanya harus di-TRUNCATE bersamaan
    // agar pengecekan FK lolos dan trigger yang menolak.
    await expectPgError(dalamRollback(owner, (tx) => tx`truncate public.transactions, public.transaction_items`), {
      message: /^Tabel transaction(s|_items) bersifat append-only: TRUNCATE tidak diizinkan/,
    });
    expect(await saldo(owner, k.nasabah)).toBe(900n);
  });

  it("app_server: UPDATE / DELETE / TRUNCATE / INSERT langsung ditolak (permission)", async () => {
    const { k, idSetor, idItem } = await siapkanData();
    const denied = (tabel: string) => ({ sqlstate: PERMISSION_DENIED, message: `permission denied for table ${tabel}` });

    await expectPgError(dalamRollback(app, (tx) => tx`update public.transactions set jumlah = 1 where id = ${idSetor}`), denied("transactions"));
    await expectPgError(dalamRollback(app, (tx) => tx`delete from public.transactions where id = ${idSetor}`), denied("transactions"));
    await expectPgError(dalamRollback(app, (tx) => tx`truncate public.transactions, public.transaction_items`), denied("transactions"));
    await expectPgError(
      dalamRollback(app, (tx) => tx`update public.transaction_items set subtotal = 1 where id = ${idItem}`),
      denied("transaction_items"),
    );
    await expectPgError(dalamRollback(app, (tx) => tx`delete from public.transaction_items where id = ${idItem}`), denied("transaction_items"));
    await expectPgError(dalamRollback(app, (tx) => tx`truncate public.transaction_items`), denied("transaction_items"));

    await expectPgError(
      dalamRollback(
        app,
        (tx) => tx`
          insert into public.transactions (customer_id, tipe, jumlah, dibuat_oleh, client_request_id)
          values (${k.nasabah}, 'tarik', -1, ${k.admin}, ${uuidBaru()}::uuid)`,
      ),
      denied("transactions"),
    );
    await expectPgError(
      dalamRollback(
        app,
        (tx) => tx`
          insert into public.transaction_items (transaction_id, waste_type_id, berat, harga_snapshot, subtotal)
          values (${idSetor}, ${k.jenis100}, 1, 100, 100)`,
      ),
      denied("transaction_items"),
    );
    expect(await saldo(owner, k.nasabah)).toBe(900n);
  });

  it("app_server: DELETE waste_types ditolak (hanya boleh dinonaktifkan)", async () => {
    const jenis = await buatJenis(owner, 1234);
    await expectPgError(dalamRollback(app, (tx) => tx`delete from public.waste_types where id = ${jenis}`), {
      sqlstate: PERMISSION_DENIED,
      message: "permission denied for table waste_types",
    });
    await app`update public.waste_types set aktif = false where id = ${jenis}`;
    const [r] = await owner`select aktif from public.waste_types where id = ${jenis}`;
    expect(r.aktif).toBe(false);
  });
});

describe("G. constraint deferred (insert langsung sebagai owner)", () => {
  /** Semua statement sukses; kegagalan HARUS datang saat COMMIT. */
  async function gagalSaatCommit(fn: (tx: Sql) => Promise<void>, pesan: RegExp) {
    let statementSelesai = false;
    await expectPgError(
      owner.begin(async (tx) => {
        await fn(tx as unknown as Sql);
        statementSelesai = true;
      }),
      { message: pesan },
    );
    expect(statementSelesai, "error harus muncul saat COMMIT, bukan saat INSERT").toBe(true);
  }

  async function insertTransaksi(tx: Sql, v: { customer: string; admin: string; tipe: string; jumlah: number; foto?: boolean }) {
    const hash = v.foto ? hashBaru() : null;
    const [r] = await tx`
      insert into public.transactions (customer_id, tipe, jumlah, dibuat_oleh, path_foto, hash_foto, client_request_id)
      values (${v.customer}, ${v.tipe}, ${v.jumlah}, ${v.admin}, ${v.foto ? "x.jpg" : null}, ${hash}, ${uuidBaru()}::uuid)
      returning id::text`;
    return r.id as string;
  }

  it("setor dengan SUM(subtotal) != jumlah gagal saat COMMIT", async () => {
    const k = await buatKonteks(owner);
    await gagalSaatCommit(async (tx) => {
      const id = await insertTransaksi(tx, { customer: k.nasabah, admin: k.admin, tipe: "setor", jumlah: 1_000, foto: true });
      await tx`
        insert into public.transaction_items (transaction_id, waste_type_id, berat, harga_snapshot, subtotal)
        values (${id}, ${k.jenis100}, 5, 100, 500)`;
    }, /^Transaksi setor #\d+: jumlah \(Rp1000\) tidak sama dengan total subtotal item \(Rp500\)\.$/);
    expect(await saldo(owner, k.nasabah)).toBe(0n);
  });

  it("setor tanpa item gagal saat COMMIT", async () => {
    const k = await buatKonteks(owner);
    await gagalSaatCommit(async (tx) => {
      await insertTransaksi(tx, { customer: k.nasabah, admin: k.admin, tipe: "setor", jumlah: 1_000, foto: true });
    }, /^Transaksi setor #\d+ tidak punya item\.$/);
    expect(await saldo(owner, k.nasabah)).toBe(0n);
  });

  it("tarik yang punya item gagal saat COMMIT", async () => {
    const k = await buatKonteks(owner);
    await gagalSaatCommit(async (tx) => {
      const id = await insertTransaksi(tx, { customer: k.nasabah, admin: k.admin, tipe: "tarik", jumlah: -100 });
      await tx`
        insert into public.transaction_items (transaction_id, waste_type_id, berat, harga_snapshot, subtotal)
        values (${id}, ${k.jenis100}, 1, 100, 100)`;
    }, /^Transaksi #\d+ bertipe tarik tidak boleh punya item\.$/);
    expect(await saldo(owner, k.nasabah)).toBe(0n);
  });

  it("item yang ditempel ke setor lama (transaksi lain) gagal saat COMMIT", async () => {
    const k = await buatKonteks(owner);
    const idSetor = await isiSaldo(app, k, 1_000);
    await gagalSaatCommit(async (tx) => {
      await tx`
        insert into public.transaction_items (transaction_id, waste_type_id, berat, harga_snapshot, subtotal)
        values (${idSetor}, ${k.jenis100}, 1, 100, 100)`;
    }, /^Transaksi setor #\d+: jumlah \(Rp1000\) tidak sama dengan total subtotal item \(Rp1100\)\.$/);
  });
});
