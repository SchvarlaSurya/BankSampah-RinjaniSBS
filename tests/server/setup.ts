import { vi } from "vitest";
import { urlTesDb } from "../db/env";

// Env untuk kode server/** saat tes. DATABASE_URL SELALU ditimpa ke DB tes lokal (app_server),
// jadi nilai dari shell / .env tidak pernah dipakai.
process.env.DATABASE_URL = urlTesDb().appUrl;
process.env.BETTER_AUTH_SECRET = "tes-lokal-bukan-rahasia-0123456789abcdef";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.TRUSTED_ORIGINS = "";

vi.mock("next/headers", () => import("./next-headers-mock"));
vi.mock("next/headers.js", () => import("./next-headers-mock"));
