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
  priceHistory as priceHistoryTable,
  transactions as transactionsTable,
  transactionItems as transactionItemsTable,
  loginGagalUsername as loginGagalUsernameTable,
} from "@/server/db/schema";
import { buatPasswordSementara } from "@/server/pengguna";
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
  GetLatestIdByRtInput,
  LatestIdByRtResult,
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
  GetLatestIdByRtInputSchema,
  ResetPasswordInputSchema,
  SetStatusPenggunaInputSchema,
  SimpanJenisSampahInputSchema,
  SetorInputSchema,
  TarikInputSchema,
  KoreksiInputSchema,
} from "@/src/contract";
import { getSesi, SESSION_COOKIE_NAME } from "./_session";
import { simpanFoto, hapusFoto } from "./_storage";
import { getTransaksi } from "./queries";

import { auth } from "@/server/auth";

async function hashPassword(password: string): Promise<string> {
  const ctx = await auth.$context;
  return ctx.password.hash(password);
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const ctx = await auth.$context;
  return ctx.password.verify({ password, hash: storedHash });
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
    const isValid = await verifyPassword(password, acc.password);
    if (!isValid) {
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
  try {
    const sesi = await getSesi();
    if (!sesi) return fail("TIDAK_LOGIN");

    const parsed = GantiPasswordInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);

    const [acc] = await db
      .select()
      .from(accountTable)
      .where(and(eq(accountTable.userId, sesi.userId), eq(accountTable.providerId, "credential")))
      .limit(1);

    if (acc?.password) {
      const isValid = await verifyPassword(parsed.data.passwordLama, acc.password);
      if (!isValid) {
        return fail("PASSWORD_LAMA_SALAH");
      }
    }

    const newHashedPassword = await hashPassword(parsed.data.passwordBaru);

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
  } catch (error: any) {
    console.error("=== ERROR GANTI PASSWORD ===", error);
    const code = kodeDariPesanDb(error?.message || error?.detail);
    return fail(code as ErrorCode);
  }
}

export async function buatPengguna(input: BuatPenggunaInput): Promise<ActionResult<PenggunaBaruResult>> {
  const sesi = await getSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  
  const parsed = BuatPenggunaInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const { role, username, nama } = parsed.data;

  // Admin hanya boleh membuat nasabah, super_admin boleh membuat admin atau nasabah
  if (sesi.role !== "super_admin" && (sesi.role !== "admin" || role !== "nasabah")) {
    return fail("TIDAK_DIIZINKAN");
  }

  const [existing] = await db
    .select()
    .from(userTable)
    .where(sql`lower(${userTable.username}) = ${username.toLowerCase()}`)
    .limit(1);

  if (existing) return fail("USERNAME_SUDAH_ADA");

  const newUserId = `${role}_${crypto.randomUUID()}`;
  // Untuk nasabah, default password sama dengan Username / ID Nasabah agar mudah diingat
  const tempPassword = role === "nasabah" ? username : genPassword();
  const hashedPassword = await hashPassword(tempPassword);

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

export async function getLatestIdByRt(input: GetLatestIdByRtInput): Promise<ActionResult<LatestIdByRtResult>> {
  const sesi = await getSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role !== "super_admin" && sesi.role !== "admin") return fail("TIDAK_DIIZINKAN");

  const parsed = GetLatestIdByRtInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const rawRt = parsed.data.rtNumber.replace(/\D/g, "");
  const rtFormatted = (rawRt ? rawRt : parsed.data.rtNumber).padStart(2, "0");

  const rows = await db
    .select({ username: userTable.username })
    .from(userTable)
    .where(
      and(
        eq(userTable.role, "nasabah"),
        sql`${userTable.username} LIKE ${rtFormatted + "%"}`
      )
    );

  let maxSeq = 0;
  for (const r of rows) {
    if (!r.username) continue;
    const match = r.username.match(new RegExp(`^${rtFormatted}(\\d{2,})$`));
    if (match && match[1]) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const nextId = `${rtFormatted}${String(nextSeq).padStart(2, "0")}`;

  return ok({
    nextId,
    rt: rtFormatted,
    count: maxSeq,
  });
}

export async function resetPasswordPengguna(input: ResetPasswordInput): Promise<ActionResult<ResetPasswordResult>> {
  const sesi = await getSesi();
  if (!sesi) return fail("TIDAK_LOGIN");
  if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
  if (sesi.role !== "super_admin") return fail("TIDAK_DIIZINKAN");

  const parsed = ResetPasswordInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  if (parsed.data.userId === sesi.userId) {
    return fail("TIDAK_DIIZINKAN");
  }

  const [targetUser] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, parsed.data.userId))
    .limit(1);

  if (!targetUser) return fail("PENGGUNA_TIDAK_DITEMUKAN");

  // Akun super_admin TIDAK boleh direset lewat panel oleh siapa pun (termasuk super_admin lain)
  if (targetUser.role === "super_admin") {
    return fail("TIDAK_DIIZINKAN");
  }

  // Target yang boleh direset hanya admin dan nasabah
  if (targetUser.role !== "admin" && targetUser.role !== "nasabah") {
    return fail("TIDAK_DIIZINKAN");
  }

  const tempPassword = buatPasswordSementara(12);
  const hashedPassword = await hashPassword(tempPassword);

  try {
    await db.transaction(async (tx) => {
      // 1. Update/Insert password hash di accountTable
      const [acc] = await tx
        .select()
        .from(accountTable)
        .where(and(eq(accountTable.userId, targetUser.id), eq(accountTable.providerId, "credential")))
        .limit(1);

      if (acc) {
        await tx
          .update(accountTable)
          .set({ password: hashedPassword })
          .where(eq(accountTable.id, acc.id));
      } else {
        await tx.insert(accountTable).values({
          id: crypto.randomUUID(),
          accountId: targetUser.id,
          providerId: "credential",
          userId: targetUser.id,
          password: hashedPassword,
        });
      }

      // 2. Set mustChangePassword = true
      await tx
        .update(userTable)
        .set({ mustChangePassword: true })
        .where(eq(userTable.id, targetUser.id));

      // 3. Cabut semua sesi lama target user
      await tx
        .delete(sessionTable)
        .where(eq(sessionTable.userId, targetUser.id));

      // 4. Reset counter login gagal / lockout jika ada username
      if (targetUser.username) {
        await tx
          .delete(loginGagalUsernameTable)
          .where(eq(loginGagalUsernameTable.username, targetUser.username.toLowerCase()));
      }
    });

    return ok({
      passwordSementara: tempPassword,
    });
  } catch (error) {
    console.error("Error in resetPasswordPengguna:", error);
    return fail("SERVER_ERROR");
  }
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
  const session = sesi ? { user: { id: sesi.userId, role: sesi.role, name: sesi.nama, username: sesi.username } } : null;

  if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
    throw new Error("Akses ditolak. Hanya admin yang dapat mengubah harga.");
  }

  if (sesi?.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");

  const parsed = SimpanJenisSampahInputSchema.safeParse(input);
  if (!parsed.success) return failDariZod(parsed.error);

  const { id, nama, hargaBeli, hargaJual, aktif } = parsed.data;

  try {
    return await db.transaction(async (tx) => {
      if (id) {
        const idNum = Number(id);
        const [existing] = await tx
          .select()
          .from(wasteTypesTable)
          .where(eq(wasteTypesTable.id, idNum))
          .limit(1);

        if (!existing) return fail("JENIS_SAMPAH_TIDAK_VALID");

        const updateData: { nama: string; hargaBeli: number; aktif: boolean; hargaJual?: number | null } = {
          nama,
          hargaBeli,
          aktif,
        };
        if (hargaJual !== undefined) {
          updateData.hargaJual = hargaJual;
        }

        const [updated] = await tx
          .update(wasteTypesTable)
          .set(updateData)
          .where(eq(wasteTypesTable.id, idNum))
          .returning();

        if (existing.hargaBeli !== updated.hargaBeli) {
          await tx.insert(priceHistoryTable).values({
            sampahId: updated.id,
            hargaLama: existing.hargaBeli,
            hargaBaru: updated.hargaBeli,
            diubahOleh: session.user.id,
          });
        }

        return ok({
          id: String(updated.id),
          nama: updated.nama,
          hargaBeli: updated.hargaBeli,
          hargaJual: updated.hargaJual ?? Math.round(updated.hargaBeli * 1.2),
          aktif: updated.aktif,
        });
      } else {
        const [newRow] = await tx
          .insert(wasteTypesTable)
          .values({
            nama,
            hargaBeli,
            hargaJual: hargaJual ?? Math.round(hargaBeli * 1.2),
            aktif,
          })
          .returning();

        await tx.insert(priceHistoryTable).values({
          sampahId: newRow.id,
          hargaLama: 0,
          hargaBaru: newRow.hargaBeli,
          diubahOleh: session.user.id,
        });

        return ok({
          id: String(newRow.id),
          nama: newRow.nama,
          hargaBeli: newRow.hargaBeli,
          hargaJual: newRow.hargaJual ?? Math.round(newRow.hargaBeli * 1.2),
          aktif: newRow.aktif,
        });
      }
    });
  } catch (error: any) {
    if (error?.message === "Akses ditolak. Hanya admin yang dapat mengubah harga.") {
      throw error;
    }
    console.error("Error saat menyimpan jenis sampah:", error);
    return fail("SERVER_ERROR");
  }
}

export async function updateHargaSampah(input: SimpanJenisSampahInput): Promise<ActionResult<JenisSampah>> {
  const sesi = await getSesi();
  const session = sesi ? { user: { id: sesi.userId, role: sesi.role, name: sesi.nama, username: sesi.username } } : null;

  if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
    throw new Error("Akses ditolak. Hanya admin yang dapat mengubah harga.");
  }

  return simpanJenisSampah(input);
}

export async function setor(formData: FormData): Promise<ActionResult<MutasiResult>> {
  try {
    const sesi = await getSesi();
    if (!sesi) return fail("TIDAK_LOGIN");
    if (sesi.mustChangePassword) return fail("WAJIB_GANTI_PASSWORD");
    if (sesi.role === "nasabah") return fail("TIDAK_DIIZINKAN");

    const { payload, foto } = parseSetorFormData(formData);
    console.log("=== SETOR: PAYLOAD DITERIMA ===", JSON.stringify(payload, null, 2));
    console.log("=== SETOR: FOTO ===", foto ? `${foto.name} (${foto.size} bytes)` : "TIDAK ADA");

    const parsed = SetorInputSchema.safeParse(payload);
    if (!parsed.success) {
      console.error("=== SETOR: ZOD VALIDATION GAGAL ===", JSON.stringify(parsed.error.flatten(), null, 2));
      return failDariZod(parsed.error);
    }

    const { customerId, items, catatan, clientRequestId } = parsed.data;
    console.log("=== SETOR: PARSED ===", { customerId, catatan, clientRequestId, itemCount: items.length });

    // 1. Validasi admin di DB
    const adminId = sesi.userId;
    console.log("=== SETOR: ADMIN ID ===", adminId);
    const [adminUser] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.id, adminId))
      .limit(1);
    if (!adminUser) {
      console.error("=== SETOR: ADMIN TIDAK ADA DI DB ===", adminId);
      return fail("TIDAK_DIIZINKAN");
    }
    console.log("=== SETOR: ADMIN OK ===", adminUser.id);

    // 2. Validasi nasabah di DB
    const [nasabahUser] = await db
      .select({ id: userTable.id, aktif: userTable.aktif })
      .from(userTable)
      .where(eq(userTable.id, customerId))
      .limit(1);
    if (!nasabahUser) {
      console.error("=== SETOR: NASABAH TIDAK ADA ===", customerId);
      return fail("NASABAH_TIDAK_DITEMUKAN");
    }
    if (!nasabahUser.aktif) {
      return fail("NASABAH_NONAKTIF");
    }
    console.log("=== SETOR: NASABAH OK ===", nasabahUser.id);

    // 3. Simpan foto (opsional)
    let pathFoto: string | null = null;
    let hashFoto: string | null = null;
    if (foto && foto.size > 0) {
      try {
        const fotoRes = await simpanFoto(foto);
        pathFoto = fotoRes.pathFoto;
        hashFoto = fotoRes.hashFoto;
      } catch (fotoErr: any) {
        console.error("Gagal menyimpan foto setor:", fotoErr?.message);
        return fail("FOTO_TIDAK_VALID");
      }
    }

    // 4. Siapkan items
    const itemsForDb = items.map((i) => ({
      waste_type_id: Number(i.wasteTypeId),
      berat: Number(i.berat),
    }));

    // 5. DB Transaction (dengan cleanup file foto bila transaksi DB gagal)
    try {
      const txResult = await db.transaction(async (tx) => {
        // Idempotency
        const [existing] = await tx
          .select()
          .from(transactionsTable)
          .where(eq(transactionsTable.clientRequestId, clientRequestId));

        if (existing) {
          const sumResult = await tx
            .select({ saldo: sql<number>`coalesce(sum(${transactionsTable.jumlah}), 0)::int` })
            .from(transactionsTable)
            .where(eq(transactionsTable.customerId, customerId));
          return { transaction_id: existing.id, saldo_baru: Number(sumResult[0]?.saldo || 0), duplikat: true };
        }

        // Hitung subtotal
        let totalJumlah = 0;
        const itemsToInsert: { wasteTypeId: number; berat: number; hargaSnapshot: number; subtotal: number }[] = [];

        for (const i of itemsForDb) {
          const [wt] = await tx.select().from(wasteTypesTable).where(eq(wasteTypesTable.id, i.waste_type_id));
          if (!wt || !wt.aktif) {
            throw new Error("JENIS_SAMPAH_TIDAK_VALID");
          }
          const subtotal = Math.round(i.berat * wt.hargaBeli);
          if (subtotal <= 0) {
            throw new Error("ITEM_TERLALU_KECIL");
          }
          totalJumlah += subtotal;
          itemsToInsert.push({ wasteTypeId: wt.id, berat: i.berat, hargaSnapshot: wt.hargaBeli, subtotal });
        }

        totalJumlah = Math.round(totalJumlah);

        // INSERT transaksi
        const [newTrx] = await tx
          .insert(transactionsTable)
          .values({
            customerId,
            dibuatOleh: adminUser.id,
            clientRequestId,
            tipe: "setor",
            jumlah: totalJumlah,
            pathFoto: pathFoto || null,
            hashFoto: hashFoto || null,
            catatan: catatan || null,
            reversesId: null,
          })
          .returning();

        // INSERT items
        for (const item of itemsToInsert) {
          await tx.insert(transactionItemsTable).values({
            transactionId: newTrx.id,
            wasteTypeId: item.wasteTypeId,
            berat: item.berat.toFixed(2),
            hargaSnapshot: item.hargaSnapshot,
            subtotal: item.subtotal,
          });
        }

        // Saldo baru
        const sumResult = await tx
          .select({ saldo: sql<number>`coalesce(sum(${transactionsTable.jumlah}), 0)::int` })
          .from(transactionsTable)
          .where(eq(transactionsTable.customerId, customerId));

        return { transaction_id: newTrx.id, saldo_baru: Number(sumResult[0]?.saldo || 0), duplikat: false };
      });

      const detailRes = await getTransaksi({ id: String(txResult.transaction_id) });
      if (!detailRes.ok) {
        return fail(detailRes.code);
      }

      return ok({ transaksi: detailRes.data, saldoBaru: txResult.saldo_baru, duplikat: txResult.duplikat });
    } catch (dbErr: any) {
      if (pathFoto) {
        await hapusFoto(pathFoto);
      }
      throw dbErr;
    }

  } catch (error: any) {
    console.error("=== ERROR SETOR ===", error);
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === "23505") {
      return fail("TERLALU_BANYAK_PERCOBAAN");
    }
    if (pgCode === "23514") {
      return fail("VALIDASI_GAGAL");
    }
    if (pgCode === "23503") {
      return fail("NASABAH_TIDAK_DITEMUKAN");
    }
    const code = kodeDariPesanDb(error?.message || error?.detail);
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
