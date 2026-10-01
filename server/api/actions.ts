"use server";

import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import {
  type ActionResult,
  fail,
  failDariZod,
  type LoginInput,
  LoginInputSchema,
  ok,
  type SesiInfo,
} from "@/contract";
import { auth } from "../auth";
import { db } from "../db";
import { user } from "../db/auth-schema";
import { logServer } from "../errors";
import { ipKlien } from "../ip";
import {
  mulaiPercobaan,
  percobaanBerhasil,
  percobaanGagal,
} from "../login-limit";

/**
 * Login tanpa guard (belum ada sesi). Semua kegagalan kredensial -- username tidak ada,
 * password salah, akun nonaktif -- menjadi KREDENSIAL_SALAH yang sama.
 */
export async function login(
  input: LoginInput,
): Promise<ActionResult<SesiInfo>> {
  try {
    const parsed = LoginInputSchema.safeParse(input);
    if (!parsed.success) return failDariZod(parsed.error);

    const h = await headers();
    // Plugin username menormalkan ke huruf kecil; kunci pembatas memakai bentuk yang sama.
    const username = parsed.data.username.toLowerCase();
    const ip = ipKlien(h);

    const percobaan = await mulaiPercobaan(username, ip);
    if (percobaan.terkunci) {
      return fail("TERLALU_BANYAK_PERCOBAAN", {
        retryAfterDetik: percobaan.retryAfterDetik,
      });
    }

    let userId: string;
    try {
      const res = await auth.api.signInUsername({
        body: { username, password: parsed.data.password },
        headers: h,
      });
      userId = res.user.id;
    } catch (e) {
      if (!gagalKredensial(e)) throw e;
      await percobaanGagal(username, ip);
      return fail("KREDENSIAL_SALAH");
    }

    await percobaanBerhasil(username, percobaan);

    const [u] = await db
      .select({
        username: user.username,
        nama: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      })
      .from(user)
      .where(eq(user.id, userId));
    return ok({
      userId,
      username: u.username ?? username,
      nama: u.nama,
      role: u.role,
      mustChangePassword: u.mustChangePassword,
    });
  } catch (e) {
    logServer("login", e);
    return fail("SERVER_ERROR");
  }
}

/**
 * Kegagalan yang berarti "kredensial tidak diterima". FAILED_TO_CREATE_SESSION muncul saat
 * hook sesi menolak akun nonaktif (server/auth.ts) -- sengaja disamakan dengan password salah.
 */
function gagalKredensial(e: unknown): boolean {
  if (!isAPIError(e)) return false;
  const code = (e.body as { code?: string } | undefined)?.code;
  return (
    e.status === "UNAUTHORIZED" ||
    e.status === "UNPROCESSABLE_ENTITY" ||
    code === "FAILED_TO_CREATE_SESSION"
  );
}
