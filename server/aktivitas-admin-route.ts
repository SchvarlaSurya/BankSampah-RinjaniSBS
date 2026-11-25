import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { AKSES } from "@/contract";
import { catatHeartbeat, muatAktivitasAdmin, pingKeepalive, tandaiOffline } from "./aktivitas-admin";
import { logServer } from "./errors";
import { sesiDariCookie, type SesiServer } from "./guards";
import { env } from "./konfigurasi";

const TANPA_CACHE = { "cache-control": "no-store" };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...TANPA_CACHE, "content-type": "application/json" } });

/**
 * Guard route presence, urutan sama dengan kontrak: tidak login -> 401; wajib ganti password atau
 * bukan staf -> 403. Klien berhenti mengirim heartbeat begitu menerima 401/403.
 */
async function sesiStaf(): Promise<{ ok: true; sesi: SesiServer } | { ok: false; res: Response }> {
  const sesi = await sesiDariCookie();
  if (!sesi) return { ok: false, res: json(401, { code: "TIDAK_LOGIN" }) };
  if (sesi.mustChangePassword) return { ok: false, res: json(403, { code: "WAJIB_GANTI_PASSWORD" }) };
  if (!AKSES.getAktivitasAdmin.includes(sesi.role)) return { ok: false, res: json(403, { code: "TIDAK_DIIZINKAN" }) };
  return { ok: true, sesi };
}

/**
 * POST dengan cookie: tolak permintaan lintas situs. Cookie sesi sudah SameSite=Lax, ini lapis
 * kedua. Origin kosong (sebagian sendBeacon lama) diterima; cookie Lax tetap tidak ikut lintas situs.
 */
function originSah(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const izin = [env.BETTER_AUTH_URL, ...env.TRUSTED_ORIGINS].map((u) => new URL(u).origin);
  return izin.includes(origin) || origin === new URL(req.url).origin;
}

/** GET /api/admin/presence: data dashboard (streak + Tim Admin + serverNow). */
export async function getPresence(): Promise<Response> {
  try {
    const g = await sesiStaf();
    if (!g.ok) return g.res;
    return json(200, await muatAktivitasAdmin(g.sesi));
  } catch (e) {
    logServer("GET presence", e);
    return json(500, { code: "SERVER_ERROR" });
  }
}

/** POST /api/admin/presence {status: "online" | "offline"}: heartbeat atau tandai offline. */
export async function postPresence(req: Request): Promise<Response> {
  try {
    if (!originSah(req)) return json(403, { code: "TIDAK_DIIZINKAN" });
    const g = await sesiStaf();
    if (!g.ok) return g.res;
    let status: unknown = "online";
    try {
      const body = (await req.json()) as { status?: unknown } | null;
      status = body?.status ?? "online";
    } catch {
      // Body kosong = heartbeat biasa.
    }
    if (status === "offline") await tandaiOffline(g.sesi.userId);
    else if (status === "online") await catatHeartbeat(g.sesi);
    else return json(400, { code: "VALIDASI_GAGAL" });
    return new Response(null, { status: 204, headers: TANPA_CACHE });
  } catch (e) {
    logServer("POST presence", e);
    return json(500, { code: "SERVER_ERROR" });
  }
}

/** Bandingkan rahasia tanpa membocorkan panjang/isi lewat waktu respons. */
function rahasiaCocok(diterima: string, harap: string): boolean {
  const a = createHash("sha256").update(diterima).digest();
  const b = createHash("sha256").update(harap).digest();
  return timingSafeEqual(a, b);
}

/** GET /api/cron/keepalive, header Authorization: Bearer <CRON_SECRET>. */
export async function getKeepalive(req: Request): Promise<Response> {
  if (!env.CRON_SECRET) return json(503, { code: "CRON_SECRET_BELUM_DISET" });
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!token || !rahasiaCocok(token, env.CRON_SECRET)) return json(401, { code: "TIDAK_DIIZINKAN" });
  try {
    return json(200, { ok: true, ...(await pingKeepalive()) });
  } catch (e) {
    logServer("keepalive", e);
    return json(500, { code: "SERVER_ERROR" });
  }
}
