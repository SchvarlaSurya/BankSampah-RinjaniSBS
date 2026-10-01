import { beforeAll, describe, expect, it } from "vitest";
import { AKSES, type ErrorCode, BOLEH_SAAT_WAJIB_GANTI_PASSWORD, fail, type Role } from "@/contract";
import { type NamaAkses, requireAkses } from "@/server/guards";
import { bukaKoneksi } from "../db/clients";
import { buatAkun, masuk } from "./akun";
import { Browser, sebagai } from "./next-headers-mock";

const { owner } = bukaKoneksi();

// login tidak memakai guard (dipanggil tanpa sesi); semua nama lain diuji.
const NAMA = (Object.keys(AKSES) as NamaAkses[]).filter((n) => n !== "login");

type Subjek = "anonim" | Role | "nonaktif" | "mustChangePassword";
const SUBJEK: Subjek[] = ["anonim", "nasabah", "admin", "super_admin", "nonaktif", "mustChangePassword"];

/** Hasil yang diharapkan, diturunkan dari aturan kontrak (urutan Bagian 8.1). */
function harapan(subjek: Subjek, nama: NamaAkses): "OK" | ErrorCode {
  if (subjek === "anonim" || subjek === "nonaktif") return "TIDAK_LOGIN";
  const role: Role = subjek === "mustChangePassword" ? "admin" : subjek;
  if (subjek === "mustChangePassword" && !(BOLEH_SAAT_WAJIB_GANTI_PASSWORD as readonly string[]).includes(nama)) {
    return "WAJIB_GANTI_PASSWORD";
  }
  return AKSES[nama].includes(role) ? "OK" : "TIDAK_DIIZINKAN";
}

const browser = {} as Record<Subjek, Browser>;
let idNonaktif = "";

beforeAll(async () => {
  browser.anonim = new Browser();
  for (const role of ["nasabah", "admin", "super_admin"] as const) browser[role] = await masuk(await buatAkun(role));
  browser.mustChangePassword = await masuk(await buatAkun("admin", { mustChangePassword: true }));
  const n = await buatAkun("nasabah");
  browser.nonaktif = await masuk(n);
  idNonaktif = n.userId;
  // Dinonaktifkan SETELAH login: cookie masih valid di sisi Better Auth.
  await owner`update public."user" set aktif = false where id = ${idNonaktif}`;
});

async function jalankan(subjek: Subjek, nama: NamaAkses): Promise<"OK" | ErrorCode> {
  const g = await sebagai(browser[subjek], () => requireAkses(nama));
  if (g.ok) return "OK";
  expect(g.hasil).toEqual(fail(g.hasil.ok ? "SERVER_ERROR" : g.hasil.code));
  return g.hasil.ok ? "SERVER_ERROR" : g.hasil.code;
}

describe("guard requireAkses: matriks AKSES x subjek", () => {
  for (const subjek of SUBJEK) {
    it(`${subjek}: ${NAMA.length} fungsi sesuai kontrak`, async () => {
      const dapat: Record<string, string> = {};
      const harap: Record<string, string> = {};
      for (const nama of NAMA) {
        dapat[nama] = await jalankan(subjek, nama);
        harap[nama] = harapan(subjek, nama);
      }
      expect(dapat).toEqual(harap);
    });
  }

  it("titik uji eksplisit (tidak diturunkan dari AKSES)", async () => {
    expect(await jalankan("nasabah", "setor")).toBe("TIDAK_DIIZINKAN");
    expect(await jalankan("nasabah", "getProfilSaya")).toBe("OK");
    expect(await jalankan("admin", "getProfilSaya")).toBe("TIDAK_DIIZINKAN");
    expect(await jalankan("admin", "tarik")).toBe("OK");
    expect(await jalankan("admin", "koreksi")).toBe("TIDAK_DIIZINKAN");
    expect(await jalankan("super_admin", "koreksi")).toBe("OK");
    expect(await jalankan("super_admin", "auditTransaksi")).toBe("OK");
    expect(await jalankan("mustChangePassword", "gantiPassword")).toBe("OK");
    expect(await jalankan("mustChangePassword", "getSesi")).toBe("OK");
    expect(await jalankan("mustChangePassword", "tarik")).toBe("WAJIB_GANTI_PASSWORD");
  });

  it("sesi akun nonaktif dihapus dari DB", async () => {
    const [r] = await owner`select count(*)::int as n from public.session where user_id = ${idNonaktif}`;
    expect(r.n).toBe(0);
  });

  it("cookie palsu / dirusak -> TIDAK_LOGIN", async () => {
    const b = new Browser();
    b.jar.set("better-auth.session_token", { value: "palsu.tidak-bertanda-tangan", opsi: {} });
    expect(await sebagai(b, () => requireAkses("getSesi"))).toEqual({ ok: false, hasil: fail("TIDAK_LOGIN") });
  });
});

describe("role dibaca dari DB pada setiap request", () => {
  it("role diubah di DB -> request berikutnya (cookie sama) langsung memakai role baru", async () => {
    const a = await buatAkun("nasabah");
    const b = await masuk(a);
    const coba = () => sebagai(b, () => requireAkses("setor"));

    expect(await coba()).toEqual({ ok: false, hasil: fail("TIDAK_DIIZINKAN") });
    await owner`update public."user" set role = 'admin' where id = ${a.userId}`;
    const g = await coba();
    expect(g.ok && g.sesi.role).toBe("admin");
    await owner`update public."user" set role = 'nasabah' where id = ${a.userId}`;
    expect(await coba()).toEqual({ ok: false, hasil: fail("TIDAK_DIIZINKAN") });

    await owner`update public."user" set must_change_password = true where id = ${a.userId}`;
    expect(await sebagai(b, () => requireAkses("getProfilSaya"))).toEqual({ ok: false, hasil: fail("WAJIB_GANTI_PASSWORD") });

    await owner`update public."user" set aktif = false where id = ${a.userId}`;
    expect(await sebagai(b, () => requireAkses("getSesi"))).toEqual({ ok: false, hasil: fail("TIDAK_LOGIN") });
    // Diaktifkan lagi pun sesi lama sudah dicabut: harus login ulang.
    await owner`update public."user" set aktif = true, must_change_password = false where id = ${a.userId}`;
    expect(await sebagai(b, () => requireAkses("getSesi"))).toEqual({ ok: false, hasil: fail("TIDAK_LOGIN") });
  });
});
