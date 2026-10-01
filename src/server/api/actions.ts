"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  user as userTable,
  session as sessionTable,
  account as accountTable,
  wasteTypes as wasteTypesTable,
} from "@/server/db/schema";
import type {
  SesiInfo,
  MutasiResult,
  PenggunaBaruResult,
  ResetPasswordResult,
  PenggunaRingkas,
  JenisSampah,
  Role,
  UserId,
  ErrorCode,
  LoginInput,
  GantiPasswordInput,
  BuatPenggunaInput,
  ResetPasswordInput,
  SetStatusPenggunaInput,
  SimpanJenisSampahInput,
  TarikInput,
  KoreksiInput,
  ActionResult,
} from "@/src/contract";
import {
  ok,
  fail,
  failDariZod,
  kodeDariPesanDb,
  parseSetorFormData,
  LoginInputSchema,
  GantiPasswordInputSchema,
  BuatPenggunaInputSchema,
  ResetPasswordInputSchema,
  SetStatusPenggunaInputSchema,
  SimpanJenisSampahInputSchema,
  SetorInputSchema,
  TarikInputSchema,
  KoreksiInputSchema,
} from "@/src/contract";
import { getSesi, SESSION_COOKIE_NAME } from "./_session";
import { simpanFoto } from "./_storage";
import { getTransaksi } from "./queries";

function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")): string {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash.includes(":")) {
      return storedHash === password;
    }
    const [salt, originalHash] = storedHash.split(":");
    if (!salt || !originalHash) return false;
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(originalHash, "hex"));
  } catch {
    return false;
  }
}

function genPassword(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

export async function login(input: LoginInput): Promise<ActionResult<SesiInfo>> {
  const parsed = LoginInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const { username, password } = parsed.data;
  const cleanUsername = username.toLowerCase();

  const [u] = await db
    .select()
    .from(userTable)
    .where(sql`lower(coalesce(${userTable.username}, ${userTable.email})) = ${cleanUsername}`)
    .limit(1);

  if (!u) return fail("KREDENSIAL_SALAH");
  if (!u.aktif) return fail("TIDAK_DIIZINKAN");

  const [acc] = await db
    .select()
    .from(accountTable)
    .where(and(eq(accountTable.userId, u.id), eq(accountTable.providerId, "credential")))
    .limit(1);

  if (acc?.password) {
    if (!verifyPassword(password, acc.password)) {
      return fail("KREDENSIAL_SALAH");
    }
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sessionTable).values({
    id: crypto.randomUUID(),
    token,
    userId: u.id,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  const sesi: SesiInfo = {
    userId: u.id as UserId,
    username: u.username || u.email,
    nama: u.name,
    role: u.role as Role,
    mustChangePassword: u.mustChangePassword,
  };

  return ok(sesi);
}

export async function logout(): Promise<ActionResult<null>> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      await db.delete(sessionTable).where(eq(sessionTable.token, token));
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (e) {
    console.error("Error during logout:", e);
  }
  return ok(null);
}

export async function gantiPassword(input: GantiPasswordInput): Promise<ActionResult<null>> {
  const sesi = await getSesi();
  if (!sesi) return fail("TIDAK_LOGIN");

  const parsed = GantiPasswordInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const [acc] = await db
    .select()
    .from(accountTable)
    .where(and(eq(accountTable.userId, sesi.userId), eq(accountTable.providerId, "credential")))
    .limit(1);

  if (acc?.password && !verifyPassword(parsed.data.passwordLama, acc.password)) {
    return fail("PASSWORD_LAMA_SALAH");
  }

  const newHashedPassword = hashPassword(parsed.data.passwordBaru);

  if (acc) {
    await db
      .update(accountTable)
      .set({ password: newHashedPassword })
      .where(eq(accountTable.id, acc.id));
  } else {
    await db.insert(accountTable).values({
      id: crypto.randomUUID(),
      accountId: sesi.userId,
      providerId: "credential",
      userId: sesi.userId,
      password: newHashedPassword,
    });
  }

  await db
    .update(userTable)
    .set({ mustChangePassword: false })
    .where(eq(userTable.id, sesi.userId));

  return ok(null);
}

export async function buatPengguna(input: BuatPenggunaInput): Promise<ActionResult<PenggunaBaruResult>> {
  const sesi = await getSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

  const parsed = BuatPenggunaInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const { role, username, nama } = parsed.data;

  const [existing] = await db
    .select()
    .from(userTable)
    .where(sql`lower(${userTable.username}) = ${username.toLowerCase()}`)
    .limit(1);

  if (existing) return fail("USERNAME_SUDAH_ADA");

  const newUserId = `${role}_${crypto.randomUUID()}`;
  const tempPassword = genPassword();
  const hashedPassword = hashPassword(tempPassword);

  await db.insert(userTable).values({
    id: newUserId,
    name: nama,
    email: `${username}@bank-sampah.local`,
    username,
    displayUsername: username,
    role,
    mustChangePassword: true,
    aktif: true,
  });

  await db.insert(accountTable).values({
    id: crypto.randomUUID(),
    accountId: newUserId,
    providerId: "credential",
    userId: newUserId,
    password: hashedPassword,
  });

  const pengguna: PenggunaRingkas = {
    id: newUserId as UserId,
    username,
    nama,
    role,
    aktif: true,
  };

  const res: PenggunaBaruResult = {
    pengguna,
    passwordSementara: tempPassword,
  };

  return ok(res);
}

export async function resetPasswordPengguna(input: ResetPasswordInput): Promise<ActionResult<ResetPasswordResult>> {
  const sesi = await getSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

  const parsed = ResetPasswordInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const [targetUser] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, parsed.data.userId))
    .limit(1);

  if (!targetUser) return fail("PENGGUNA_TIDAK_DITEMUKAN");

  const tempPassword = genPassword();
  const hashedPassword = hashPassword(tempPassword);

  const [acc] = await db
    .select()
    .from(accountTable)
    .where(and(eq(accountTable.userId, targetUser.id), eq(accountTable.providerId, "credential")))
    .limit(1);

  if (acc) {
    await db
      .update(accountTable)
      .set({ password: hashedPassword })
      .where(eq(accountTable.id, acc.id));
  } else {
    await db.insert(accountTable).values({
      id: crypto.randomUUID(),
      accountId: targetUser.id,
      providerId: "credential",
      userId: targetUser.id,
      password: hashedPassword,
    });
  }

  await db
    .update(userTable)
    .set({ mustChangePassword: true })
    .where(eq(userTable.id, targetUser.id));

  const res: ResetPasswordResult = {
    passwordSementara: tempPassword,
  };

  return ok(res);
}

export async function setStatusPengguna(input: SetStatusPenggunaInput): Promise<ActionResult<PenggunaRingkas>> {
  const sesi = await getSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

  const parsed = SetStatusPenggunaInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  if (parsed.data.userId === sesi.userId) {
    return fail("TIDAK_BISA_NONAKTIFKAN_DIRI");
  }

  const [targetUser] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, parsed.data.userId))
    .limit(1);

  if (!targetUser) return fail("PENGGUNA_TIDAK_DITEMUKAN");

  await db
    .update(userTable)
    .set({ aktif: parsed.data.aktif })
    .where(eq(userTable.id, targetUser.id));

  const updated: PenggunaRingkas = {
    id: targetUser.id as UserId,
    username: targetUser.username || targetUser.email,
    nama: targetUser.name,
    role: targetUser.role as Role,
    aktif: parsed.data.aktif,
  };

  return ok(updated);
}

export async function simpanJenisSampah(input: SimpanJenisSampahInput): Promise<ActionResult<JenisSampah>> {
  const sesi = await getSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

  const parsed = SimpanJenisSampahInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const { id, nama, hargaBeli, aktif } = parsed.data;

  if (id) {
    const idNum = Number(id);
    const [existing] = await db
      .select()
      .from(wasteTypesTable)
      .where(eq(wasteTypesTable.id, idNum))
      .limit(1);

    if (!existing) return fail("JENIS_SAMPAH_TIDAK_VALID");

    const [updated] = await db
      .update(wasteTypesTable)
      .set({ nama, hargaBeli, aktif })
      .where(eq(wasteTypesTable.id, idNum))
      .returning();

    return ok({
      id: String(updated.id),
      nama: updated.nama,
      hargaBeli: updated.hargaBeli,
      aktif: updated.aktif,
    });
  } else {
    const [newRow] = await db
      .insert(wasteTypesTable)
      .values({ nama, hargaBeli, aktif })
      .returning();

    return ok({
      id: String(newRow.id),
      nama: newRow.nama,
      hargaBeli: newRow.hargaBeli,
      aktif: newRow.aktif,
    });
  }
}

export async function setor(formData: FormData): Promise<ActionResult<MutasiResult>> {
  const sesi = await getSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role === "nasabah") return fail("TIDAK_DIIZINKAN");

  const { payload, foto } = parseSetorFormData(formData);
  if (!foto) return fail("FOTO_WAJIB");

  const parsed = SetorInputSchema.safeParse(payload);
  if (!parsed.success) return failDariZod(parsed.error);

  const { customerId, items, catatan, clientRequestId } = parsed.data;

  const { pathFoto, hashFoto } = await simpanFoto(foto);

  const itemsForDb = items.map((i) => ({
    waste_type_id: Number(i.wasteTypeId),
    berat: Number(i.berat),
  }));

  try {
    const sqlResult = await db.execute<{
      transaction_id: string;
      saldo_baru: string;
      duplikat: boolean;
    }>(sql`
      select * from public.setor(
        ${customerId},
        ${sesi.userId},
        ${clientRequestId}::uuid,
        ${JSON.stringify(itemsForDb)}::text::jsonb,
        ${pathFoto},
        ${hashFoto},
        ${catatan ?? null}
      )
    `);

    const row = sqlResult[0];
    if (!row) return fail("SERVER_ERROR");

    const detailRes = await getTransaksi({ id: String(row.transaction_id) });
    if (!detailRes.ok) return fail(detailRes.code);

    const res: MutasiResult = {
      transaksi: detailRes.data,
      saldoBaru: Number(row.saldo_baru),
      duplikat: row.duplikat,
    };

    return ok(res);
  } catch (err: any) {
    const code = kodeDariPesanDb(err.message || err.detail);
    return fail(code as ErrorCode);
  }
}

export async function tarik(input: TarikInput): Promise<ActionResult<MutasiResult>> {
  const sesi = await getSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role === "nasabah") return fail("TIDAK_DIIZINKAN");

  const parsed = TarikInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const { customerId, jumlah, catatan, clientRequestId } = parsed.data;

  try {
    const sqlResult = await db.execute<{
      transaction_id: string;
      saldo_baru: string;
      duplikat: boolean;
    }>(sql`
      select * from public.tarik(
        ${customerId},
        ${sesi.userId},
        ${clientRequestId}::uuid,
        ${jumlah}::integer,
        ${catatan ?? null}
      )
    `);

    const row = sqlResult[0];
    if (!row) return fail("SERVER_ERROR");

    const detailRes = await getTransaksi({ id: String(row.transaction_id) });
    if (!detailRes.ok) return fail(detailRes.code);

    const res: MutasiResult = {
      transaksi: detailRes.data,
      saldoBaru: Number(row.saldo_baru),
      duplikat: row.duplikat,
    };

    return ok(res);
  } catch (err: any) {
    const code = kodeDariPesanDb(err.message || err.detail);
    return fail(code as ErrorCode);
  }
}

export async function koreksi(input: KoreksiInput): Promise<ActionResult<MutasiResult>> {
  const sesi = await getSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

  const parsed = KoreksiInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const { transaksiId, alasan, clientRequestId } = parsed.data;

  try {
    const sqlResult = await db.execute<{
      transaction_id: string;
      saldo_baru: string;
      duplikat: boolean;
    }>(sql`
      select * from public.koreksi(
        ${Number(transaksiId)}::bigint,
        ${sesi.userId},
        ${clientRequestId}::uuid,
        ${alasan}
      )
    `);

    const row = sqlResult[0];
    if (!row) return fail("SERVER_ERROR");

    const detailRes = await getTransaksi({ id: String(row.transaction_id) });
    if (!detailRes.ok) return fail(detailRes.code);

    const res: MutasiResult = {
      transaksi: detailRes.data,
      saldoBaru: Number(row.saldo_baru),
      duplikat: row.duplikat,
    };

    return ok(res);
  } catch (err: any) {
    const code = kodeDariPesanDb(err.message || err.detail);
    return fail(code as ErrorCode);
  }
}
