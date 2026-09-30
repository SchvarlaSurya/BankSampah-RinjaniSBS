import { randomUUID } from "node:crypto";
import type { Role } from "@/contract";
import type { Sql } from "./clients";
import { beratUntukRupiah, itemsJson, setor } from "./ledger";

// TRUNCATE dilarang trigger: tidak ada bersih-bersih. Isolasi antar tes lewat data unik.

export async function buatUser(owner: Sql, role: Role, opsi: { aktif?: boolean } = {}): Promise<string> {
  const id = `${role}_${randomUUID()}`;
  await owner`
    insert into public."user" (id, name, email, role, aktif)
    values (${id}, ${`Tes ${role}`}, ${`${id}@test.local`}, ${role}, ${opsi.aktif ?? true})`;
  return id;
}

export async function setAktif(owner: Sql, userId: string, aktif: boolean): Promise<void> {
  await owner`update public."user" set aktif = ${aktif} where id = ${userId}`;
}

export async function buatJenis(owner: Sql, hargaBeli: number, opsi: { aktif?: boolean } = {}): Promise<string> {
  const [r] = await owner`
    insert into public.waste_types (nama, harga_beli, aktif)
    values (${`jenis-${randomUUID()}`}, ${hargaBeli}, ${opsi.aktif ?? true})
    returning id::text as id`;
  return r.id;
}

export interface Konteks {
  nasabah: string;
  admin: string;
  superAdmin: string;
  /** Jenis sampah Rp100/kg: dipakai isiSaldo supaya subtotal = rupiah persis. */
  jenis100: string;
}

export async function buatKonteks(owner: Sql): Promise<Konteks> {
  const [nasabah, admin, superAdmin, jenis100] = await Promise.all([
    buatUser(owner, "nasabah"),
    buatUser(owner, "admin"),
    buatUser(owner, "super_admin"),
    buatJenis(owner, 100),
  ]);
  return { nasabah, admin, superAdmin, jenis100 };
}

/** Setor sejumlah rupiah persis ke nasabah konteks. Mengembalikan id transaksi setor. */
export async function isiSaldo(app: Sql, k: Konteks, rupiah: number, customerId = k.nasabah): Promise<string> {
  const h = await setor(app, {
    customerId,
    adminId: k.admin,
    items: itemsJson([{ wasteTypeId: k.jenis100, berat: beratUntukRupiah(rupiah) }]),
  });
  return h.transactionId;
}
