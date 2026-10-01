import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES, fail } from "@/contract";
import { login } from "@/server/api/actions";
import { ipKlien } from "@/server/ip";
import { JENDELA_DETIK } from "@/server/login-limit";
import { bukaKoneksi } from "../db/clients";
import { buatAkun, ipBaru, usernameAcak } from "./akun";
import { Browser, sebagai } from "./next-headers-mock";

const { owner } = bukaKoneksi();

const coba = (b: Browser, username: string, password: string) =>
  sebagai(b, () => login({ username, password }));

const KREDENSIAL_SALAH = fail("KREDENSIAL_SALAH");

async function jumlahSesi(userId: string): Promise<number> {
  const [r] = await owner`select count(*)::int as n from public.session where user_id = ${userId}`;
  return r.n;
}

describe("ipKlien (x-vercel-forwarded-for)", () => {
  const ip = (nilai: Record<string, string>) => ipKlien(new Headers(nilai));
  it("satu IPv4 / IPv6 valid", () => {
    expect(ip({ "x-vercel-forwarded-for": "203.0.113.7" })).toBe("203.0.113.7");
    expect(ip({ "x-vercel-forwarded-for": " 203.0.113.7 " })).toBe("203.0.113.7");
    expect(ip({ "x-vercel-forwarded-for": "2001:db8:abcd:12:1:2:3:4" })).toBe("2001:0db8:abcd:0012:0000:0000:0000:0000");
    expect(ip({ "x-vercel-forwarded-for": "2001:db8::1" })).toBe("2001:0db8:0000:0000:0000:0000:0000:0000");
    expect(ip({ "x-vercel-forwarded-for": "::ffff:198.51.100.2" })).toBe("198.51.100.2");
  });
  it("daftar berkoma, nilai aneh, atau header lain -> null", () => {
    expect(ip({ "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1" })).toBeNull();
    expect(ip({ "x-vercel-forwarded-for": "bukan-ip" })).toBeNull();
    expect(ip({ "x-vercel-forwarded-for": "" })).toBeNull();
    expect(ip({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "203.0.113.7" })).toBeNull();
  });
});

describe("login", () => {
  it("sukses: SesiInfo dari DB, cookie httpOnly + sameSite=lax (tidak secure di luar produksi)", async () => {
    const a = await buatAkun("admin");
    const b = new Browser(ipBaru());
    const hasil = await coba(b, a.username.toUpperCase(), a.password);
    expect(hasil).toEqual({
      ok: true,
      data: { userId: a.userId, username: a.username, nama: "Tes admin", role: "admin", mustChangePassword: false },
    });
    const cookie = b.jar.get("better-auth.session_token");
    expect(cookie).toBeDefined();
    expect(cookie!.opsi).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(cookie!.opsi.secure).toBeFalsy();
    expect(await jumlahSesi(a.userId)).toBe(1);
  });

  it("mustChangePassword tetap bisa login (flag dikembalikan)", async () => {
    const a = await buatAkun("nasabah", { mustChangePassword: true });
    const hasil = await coba(new Browser(ipBaru()), a.username, a.password);
    expect(hasil.ok && hasil.data.mustChangePassword).toBe(true);
  });

  it("username tidak ada / password salah / akun nonaktif -> KREDENSIAL_SALAH yang identik", async () => {
    const a = await buatAkun("nasabah");
    const nonaktif = await buatAkun("admin");
    await owner`update public."user" set aktif = false where id = ${nonaktif.userId}`;
    const b = new Browser(ipBaru());

    expect(await coba(b, usernameAcak(), "password-apa-saja")).toEqual(KREDENSIAL_SALAH);
    expect(await coba(b, a.username, "password-salah-123")).toEqual(KREDENSIAL_SALAH);
    // Password BENAR tapi akun nonaktif: tetap KREDENSIAL_SALAH, tanpa sesi.
    expect(await coba(b, nonaktif.username, nonaktif.password)).toEqual(KREDENSIAL_SALAH);
    expect(KREDENSIAL_SALAH).toEqual({ ok: false, code: "KREDENSIAL_SALAH", message: ERROR_MESSAGES.KREDENSIAL_SALAH });
    expect(await jumlahSesi(nonaktif.userId)).toBe(0);
    expect(b.jar.size).toBe(0);
  });

  it("input kosong -> VALIDASI_GAGAL (zod kontrak), bukan percobaan login", async () => {
    const hasil = await coba(new Browser(ipBaru()), "", "");
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) {
      expect(hasil.code).toBe("VALIDASI_GAGAL");
      expect(Object.keys(hasil.fieldErrors ?? {}).sort()).toEqual(["password", "username"]);
    }
  });

  it("waktu respons: username tidak ada ~ password salah ~ akun nonaktif (median, 7 sampel)", async () => {
    const ukur = async (fn: () => Promise<unknown>) => {
      const t = performance.now();
      await fn();
      return performance.now() - t;
    };
    const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)];
    const tidakAda: number[] = [];
    const salah: number[] = [];
    const nonaktif: number[] = [];
    for (let i = 0; i < 7; i++) {
      // Akun & IP baru tiap sampel supaya pembatas login tidak ikut terukur.
      const a = await buatAkun("nasabah");
      const n = await buatAkun("nasabah");
      await owner`update public."user" set aktif = false where id = ${n.userId}`;
      tidakAda.push(await ukur(() => coba(new Browser(ipBaru()), usernameAcak(), "Pw-salah-000000")));
      salah.push(await ukur(() => coba(new Browser(ipBaru()), a.username, "Pw-salah-000000")));
      nonaktif.push(await ukur(() => coba(new Browser(ipBaru()), n.username, n.password)));
    }
    const m = { tidakAda: median(tidakAda), salah: median(salah), nonaktif: median(nonaktif) };
    console.log(`[login] median ms ${JSON.stringify(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v)])))}`);
    for (const [x, y] of [
      [m.tidakAda, m.salah],
      [m.nonaktif, m.salah],
    ]) {
      expect(x / y).toBeGreaterThan(0.5);
      expect(x / y).toBeLessThan(2);
    }
  });
});

describe("pembatas login per username (5 gagal / 15 menit)", () => {
  it("gagal ke-6 terkunci walau password benar; username lain tidak terpengaruh; terbuka setelah 15 menit", async () => {
    const a = await buatAkun("nasabah");
    const lain = await buatAkun("nasabah");
    const b = new Browser(null); // tanpa IP: hanya limiter per-username yang aktif

    for (let i = 0; i < 5; i++) expect(await coba(b, a.username, `salah-${i}-xxxx`)).toEqual(KREDENSIAL_SALAH);
    const terkunci = await coba(b, a.username, a.password);
    expect(terkunci.ok).toBe(false);
    if (!terkunci.ok) {
      expect(terkunci.code).toBe("TERLALU_BANYAK_PERCOBAAN");
      expect(terkunci.message).toBe(ERROR_MESSAGES.TERLALU_BANYAK_PERCOBAAN);
      expect(terkunci.retryAfterDetik).toBeGreaterThan(JENDELA_DETIK - 60);
      expect(terkunci.retryAfterDetik).toBeLessThanOrEqual(JENDELA_DETIK);
    }
    // Mencoba saat terkunci tidak memperpanjang kunci / tidak menambah baris.
    const [n] = await owner`select count(*)::int as n from public.login_gagal_username where username = ${a.username}`;
    expect(n.n).toBe(5);

    expect((await coba(b, lain.username, lain.password)).ok).toBe(true);

    // Geser semua percobaan keluar dari jendela 15 menit.
    await owner`update public.login_gagal_username set waktu = waktu - interval '16 minutes' where username = ${a.username}`;
    expect((await coba(b, a.username, a.password)).ok).toBe(true);
  });

  it("login sukses me-reset hitungan", async () => {
    const a = await buatAkun("admin");
    const b = new Browser(null);
    for (let i = 0; i < 4; i++) await coba(b, a.username, `salah-${i}-xxxx`);
    expect((await coba(b, a.username, a.password)).ok).toBe(true);
    const [n] = await owner`select count(*)::int as n from public.login_gagal_username where username = ${a.username}`;
    expect(n.n).toBe(0);
    for (let i = 0; i < 4; i++) expect(await coba(b, a.username, `salah-${i}-yyyy`)).toEqual(KREDENSIAL_SALAH);
    expect((await coba(b, a.username, a.password)).ok).toBe(true);
  });

  it("burst 10 percobaan PARALEL -> paling banyak 5 sempat memeriksa password", async () => {
    const a = await buatAkun("nasabah");
    const hasil = await Promise.all(
      Array.from({ length: 10 }, (_, i) => coba(new Browser(ipBaru()), a.username, `salah-paralel-${i}`)),
    );
    const kode = hasil.map((h) => (h.ok ? "OK" : h.code));
    expect(kode.every((k) => k === "KREDENSIAL_SALAH" || k === "TERLALU_BANYAK_PERCOBAAN")).toBe(true);
    expect(kode.filter((k) => k === "KREDENSIAL_SALAH").length).toBeLessThanOrEqual(5);
  });
});

describe("pembatas login per IP (30 gagal / 15 menit, x-vercel-forwarded-for)", () => {
  it("31 dari IP yang sama terkunci; IP lain & tanpa IP tidak; x-forwarded-for palsu diabaikan", async () => {
    const a = await buatAkun("admin");
    const ip = ipBaru();
    const penyerang = new Browser(ip);
    for (let i = 0; i < 30; i++) {
      expect(await coba(penyerang, usernameAcak("x"), "salah-xxxx")).toEqual(KREDENSIAL_SALAH);
    }
    const terkunci = await coba(penyerang, a.username, a.password);
    expect(terkunci.ok || terkunci.code).toBe("TERLALU_BANYAK_PERCOBAAN");

    // Pengguna sah di IP lain tidak ikut terkunci.
    expect((await coba(new Browser(ipBaru()), a.username, a.password)).ok).toBe(true);
    // Hanya x-vercel-forwarded-for yang dipercaya: header lain berisi IP terkunci diabaikan.
    const spoof = new Browser(ipBaru());
    spoof.headerTambahan.set("x-forwarded-for", ip);
    spoof.headerTambahan.set("x-real-ip", ip);
    expect((await coba(spoof, a.username, a.password)).ok).toBe(true);

    const [n] = await owner`select count(*)::int as n from public.login_gagal_ip where ip = ${ip}`;
    expect(n.n).toBe(30);
  });

  it("tanpa IP (header tidak ada / berisi daftar) limiter per-IP dilewati, bukan satu ember bersama", async () => {
    const a = await buatAkun("nasabah");
    const tanpaIp = new Browser(null);
    const daftar = new Browser(null);
    daftar.headerTambahan.set("x-vercel-forwarded-for", "203.0.113.50, 10.0.0.1");
    for (let i = 0; i < 31; i++) await coba(i % 2 ? tanpaIp : daftar, usernameAcak("y"), "salah-xxxx");
    expect((await coba(tanpaIp, a.username, a.password)).ok).toBe(true);
    expect((await coba(daftar, a.username, a.password)).ok).toBe(true);
  });
});
