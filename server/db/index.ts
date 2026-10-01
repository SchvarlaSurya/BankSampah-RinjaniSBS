import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";

// Supavisor transaction mode tidak mendukung prepared statement.
const createClient = () =>
  postgres(process.env.DATABASE_URL || env.DATABASE_URL, { prepare: false });

// Singleton pattern untuk pgClient dan instance Drizzle db di Node.js / dev hot reload.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof createClient>;
  db?: ReturnType<typeof drizzle<Record<string, never>>>;
};

const client = globalForDb.pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = globalForDb.db ?? drizzle({ client });
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
