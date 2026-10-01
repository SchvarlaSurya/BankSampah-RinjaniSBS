import "server-only";
import { cookies } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/server/db";
import { user as userTable, session as sessionTable } from "@/server/db/schema";
import type { SesiInfo, Role, UserId } from "@/src/contract";

export const SESSION_COOKIE_NAME = "bank_sampah_session";

export async function getSesi(): Promise<SesiInfo | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const rows = await db
      .select({
        user: userTable,
        session: sessionTable,
      })
      .from(sessionTable)
      .innerJoin(userTable, eq(sessionTable.userId, userTable.id))
      .where(
        and(
          eq(sessionTable.token, token),
          gt(sessionTable.expiresAt, new Date()),
          eq(userTable.aktif, true)
        )
      )
      .limit(1);

    if (rows.length === 0) return null;

    const u = rows[0].user;
    return {
      userId: u.id as UserId,
      username: u.username || u.email,
      nama: u.name,
      role: u.role as Role,
      mustChangePassword: u.mustChangePassword,
    };
  } catch (error) {
    console.error("Error in getSesi:", error);
    return null;
  }
}
