import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { vi } from "vitest";
import { urlTesDb } from "../db/url-tes";

// Env untuk kode server/** saat tes. DATABASE_URL SELALU ditimpa ke DB tes lokal (app_server),
// jadi nilai dari shell / .env tidak pernah dipakai.
process.env.DATABASE_URL = urlTesDb().appUrl;
process.env.BETTER_AUTH_SECRET = "tes-lokal-bukan-rahasia-0123456789abcdef";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.TRUSTED_ORIGINS = "";
// Foto ke direktori sementara unik per file tes (bukan .data/ di repo).
process.env.FOTO_STORAGE = "local";
process.env.FOTO_LOCAL_DIR = path.join(tmpdir(), "bank-sampah-foto-tes", randomUUID());

vi.mock("next/headers", () => import("./next-headers-mock"));
vi.mock("next/headers.js", () => import("./next-headers-mock"));
