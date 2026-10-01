import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../konfigurasi";

// Supavisor transaction mode tidak mendukung prepared statement.
const createClient = () => postgres(env.DATABASE_URL, { prepare: false });

// Hindari membuat pool baru tiap hot reload di dev.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof createClient>;
};

const client = globalForDb.pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle({ client });
