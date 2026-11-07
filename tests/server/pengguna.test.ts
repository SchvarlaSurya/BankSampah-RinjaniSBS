import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fail } from "@/contract";
import {
  buatPengguna,
  gantiPassword,
  login,
  logout,
  resetPasswordPengguna,
  setStatusPengguna,
} from "@/server/api/actions";
import { requireAkses } from "@/server/guards";
import { bukaKoneksi } from "../db/clients";
import { buatAkun, ipBaru, masuk, sbg, tangkapLog, usernameAcak } from "./akun";
import { Browser } from "./next-headers-mock";

const { owner } = bukaKoneksi();
const akar = fileURLToPath(new URL("../../", import.meta.url));

async function jumlahSesi(userId: string): Promise<number> {
  const [r] = await owner`select count(*)::int as n from public.session where user_id = ${userId}`;
  return r.n;
}

const masukDengan = (username: string, password: string, b = new Browser(ipBaru())) =>
  sbg(b, () => login({ username, password }));

describe("logout", () => {
  it("menghapus sesi di DB dan cookie; request berikutnya TIDAK_LOGIN", async () => {
    const a = await buatAkun("nasabah");
    const b = await masuk(a);
    expect(await sbg(b, () => logout())).toEqual({ ok: true, data: null });
    expect(b.jar.size).toBe(0);
    expect(await jumlahSesi(a.userId)).toBe(0);
    expect(await sbg(b, () => logout())).toEqual(fail("TIDAK_LOGIN"));
  });
});

describe("gantiPassword", () => {
  it("sukses: mustChangePassword=false, sesi LAIN dicabut, sesi ini tetap, password lama tak berlaku", async () => {
    const a = await buatAkun("admin", { mustChangePassword: true });
    const ini = await masuk(a);
    const lain = await masuk(a);
    expect(await jumlahSesi(a.userId)).toBe(2);
    expect(await sbg(ini, () => requireAkses("tarik"))).toEqual({ ok: false, hasil: fail("WAJIB_GANTI_PASSWORD") });

    const baru = "Kuat-Sekali-9182";
    const hasil = await sbg(ini, () => gantiPassword({ passwordLama: a.password, passwordBaru: baru, konfirmasi: baru }));
    expect(hasil).toEqual({ ok: true, data: null });

    expect((await sbg(ini, () => requireAkses("tarik"))).ok).toBe(true);
    expect(await sbg(lain, () => requireAkses("getSesi"))).toEqual({ ok: false, hasil: fail("TIDAK_LOGIN") });
    expect(await jumlahSesi(a.userId)).toBe(1);
    expect(await masukDengan(a.username, a.password)).toEqual(fail("KREDENSIAL_SALAH"));
    expect((await masukDengan(a.username, baru)).ok).toBe(true);
  });

  it("password lama salah -> PASSWORD_LAMA_SALAH dan ikut pembatas login (gagal ke-6 terkunci, login juga)", async () => {
    const a = await buatAkun("nasabah");
    const b = await masuk(a, new Browser(null));
    const baru = "Kuat-Sekali-5521";
    for (let i = 0; i < 5; i++) {
      expect(await sbg(b, () => gantiPassword({ passwordLama: `salah-${i}-xx`, passwordBaru: baru, konfirmasi: baru }))).toEqual(
        fail("PASSWORD_LAMA_SALAH"),
      );
    }
    const terkunci = await sbg(b, () => gantiPassword({ passwordLama: a.password, passwordBaru: baru, konfirmasi: baru }));
    expect(terkunci.ok || terkunci.code).toBe("TERLALU_BANYAK_PERCOBAAN");
    const loginTerkunci = await masukDengan(a.username, a.password, new Browser(null));
    expect(loginTerkunci.ok || loginTerkunci.code).toBe("TERLALU_BANYAK_PERCOBAAN");
  });

  it("password umum / memuat username / sama dengan lama / konfirmasi beda -> VALIDASI_GAGAL", async () => {
    const a = await buatAkun("nasabah");
    const b = await masuk(a);
    const coba = (passwordBaru: string, konfirmasi = passwordBaru, passwordLama = a.password) =>
      sbg(b, () => gantiPassword({ passwordLama, passwordBaru, konfirmasi }));
    for (const lemah of ["password123", "Bismillah", "12345678", "aaaaaaaa", `x${a.username}x`]) {
      const h = await coba(lemah);
      expect(h.ok).toBe(false);
      if (!h.ok) {
        expect(h.code).toBe("VALIDASI_GAGAL");
        expect(Object.keys(h.fieldErrors ?? {})).toEqual(["passwordBaru"]);
      }
    }
    const sama = await coba(a.password);
    expect(!sama.ok && sama.fieldErrors?.passwordBaru).toBeTruthy();
    const beda = await coba("Kuat-Sekali-7777", "Kuat-Sekali-7778");
    expect(!beda.ok && beda.fieldErrors?.konfirmasi).toBeTruthy();
    expect(await sbg(new Browser(), () => gantiPassword({ passwordLama: "x", passwordBaru: "y", konfirmasi: "y" }))).toEqual(
      fail("TIDAK_LOGIN"),
    );
  });
});

describe("buatPengguna (super_admin)", () => {
  it("membuat nasabah/admin dengan password sementara (sekali, tidak di-log), mustChangePassword", async () => {
    const sa = await masuk(await buatAkun("super_admin"));
    const username = usernameAcak("nb");
    const log = tangkapLog();
    let hasil: Awaited<ReturnType<typeof buatPengguna>>;
    try {
      hasil = await sbg(sa, () => buatPengguna({ role: "nasabah", username: `  ${username.toUpperCase()} `, nama: "  Bu Siti " }));
    } finally {
      log.pulihkan();
    }
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.data.pengguna).toEqual({ id: expect.any(String), username, nama: "Bu Siti", role: "nasabah", aktif: true });
    expect(hasil.data.passwordSementara).toMatch(/^[A-HJ-NP-Za-km-z2-9]{10}$/);
    expect(log.pesan.join("\n")).not.toContain(hasil.data.passwordSementara);

    const masukBaru = await masukDengan(username, hasil.data.passwordSementara);
    expect(masukBaru.ok && masukBaru.data).toMatchObject({ role: "nasabah", mustChangePassword: true });
  });

  it("USERNAME_SUDAH_ADA (termasuk beda huruf besar); validasi; admin hanya boleh membuat nasabah", async () => {
    const sa = await masuk(await buatAkun("super_admin"));
    const ada = await buatAkun("admin");
    expect(await sbg(sa, () => buatPengguna({ role: "admin", username: ada.username.toUpperCase(), nama: "Dobel" }))).toEqual(
      fail("USERNAME_SUDAH_ADA"),
    );
    const salah = await sbg(sa, () => buatPengguna({ role: "admin", username: "a b", nama: "X" }));
    expect(!salah.ok && Object.keys(salah.fieldErrors ?? {}).sort()).toEqual(["nama", "username"]);

    const admin = await masuk(ada);
    expect(await sbg(admin, () => buatPengguna({ role: "admin", username: usernameAcak(), nama: "Coba" }))).toEqual(
      fail("TIDAK_DIIZINKAN"),
    );
    const viaAdmin = await sbg(admin, () => buatPengguna({ role: "nasabah", username: usernameAcak(), nama: "Coba" }));
    expect(viaAdmin.ok && viaAdmin.data.pengguna).toMatchObject({ role: "nasabah", nama: "Coba", aktif: true });
    expect(viaAdmin.ok && viaAdmin.data.passwordSementara).toMatch(/^[A-HJ-NP-Za-km-z2-9]{10}$/);
  });

  it("dua permintaan PARALEL dengan username sama: satu sukses, satu USERNAME_SUDAH_ADA", async () => {
    const sa = await masuk(await buatAkun("super_admin"));
    const username = usernameAcak("par");
    const hasil = await Promise.all(
      [1, 2].map(() => sbg(sa, () => buatPengguna({ role: "nasabah", username, nama: "Paralel" }))),
    );
    const kode = hasil.map((h) => (h.ok ? "OK" : h.code)).sort();
    expect(kode).toEqual(["OK", "USERNAME_SUDAH_ADA"]);
    const [r] = await owner`select count(*)::int as n from public."user" where username = ${username}`;
    expect(r.n).toBe(1);
  });
});

describe("resetPasswordPengguna (super_admin)", () => {
  it("password sementara baru, mustChangePassword, SEMUA sesi target dihapus, kunci login dibuka", async () => {
    const sa = await masuk(await buatAkun("super_admin"));
    const t = await buatAkun("nasabah");
    const b1 = await masuk(t);
    const b2 = await masuk(t);
    for (let i = 0; i < 5; i++) await masukDengan(t.username, `salah-${i}-xx`, new Browser(null));

    const log = tangkapLog();
    let hasil: Awaited<ReturnType<typeof resetPasswordPengguna>>;
    try {
      hasil = await sbg(sa, () => resetPasswordPengguna({ userId: t.userId }));
    } finally {
      log.pulihkan();
    }
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(log.pesan.join("\n")).not.toContain(hasil.data.passwordSementara);

    expect(await jumlahSesi(t.userId)).toBe(0);
    for (const b of [b1, b2]) expect(await sbg(b, () => requireAkses("getSesi"))).toEqual({ ok: false, hasil: fail("TIDAK_LOGIN") });
    expect(await masukDengan(t.username, t.password)).toEqual(fail("KREDENSIAL_SALAH"));
    const baru = await masukDengan(t.username, hasil.data.passwordSementara);
    expect(baru.ok && baru.data.mustChangePassword).toBe(true);
  });

  it("PENGGUNA_TIDAK_DITEMUKAN; admin -> TIDAK_DIIZINKAN", async () => {
    const sa = await masuk(await buatAkun("super_admin"));
    expect(await sbg(sa, () => resetPasswordPengguna({ userId: "tidak-ada" }))).toEqual(fail("PENGGUNA_TIDAK_DITEMUKAN"));
    const admin = await masuk(await buatAkun("admin"));
    expect(await sbg(admin, () => resetPasswordPengguna({ userId: "x" }))).toEqual(fail("TIDAK_DIIZINKAN"));
  });
});

describe("setStatusPengguna (super_admin)", () => {
  it("nonaktif menghapus semua sesi & login ditolak; aktif lagi bisa login", async () => {
    const sa = await masuk(await buatAkun("super_admin"));
    const t = await buatAkun("admin");
    const bt = await masuk(t);
    const nonaktif = await sbg(sa, () => setStatusPengguna({ userId: t.userId, aktif: false }));
    expect(nonaktif).toEqual({ ok: true, data: { id: t.userId, username: t.username, nama: "Tes admin", role: "admin", aktif: false } });
    expect(await jumlahSesi(t.userId)).toBe(0);
    expect(await sbg(bt, () => requireAkses("getSesi"))).toEqual({ ok: false, hasil: fail("TIDAK_LOGIN") });
    expect(await masukDengan(t.username, t.password)).toEqual(fail("KREDENSIAL_SALAH"));

    expect((await sbg(sa, () => setStatusPengguna({ userId: t.userId, aktif: true }))).ok).toBe(true);
    expect((await masukDengan(t.username, t.password)).ok).toBe(true);
  });

  it("TIDAK_BISA_NONAKTIFKAN_DIRI; PENGGUNA_TIDAK_DITEMUKAN; admin -> TIDAK_DIIZINKAN", async () => {
    const saAkun = await buatAkun("super_admin");
    const sa = await masuk(saAkun);
    expect(await sbg(sa, () => setStatusPengguna({ userId: saAkun.userId, aktif: false }))).toEqual(fail("TIDAK_BISA_NONAKTIFKAN_DIRI"));
    expect((await sbg(sa, () => requireAkses("getSesi"))).ok).toBe(true);
    expect(await sbg(sa, () => setStatusPengguna({ userId: "tidak-ada", aktif: false }))).toEqual(fail("PENGGUNA_TIDAK_DITEMUKAN"));
    const admin = await masuk(await buatAkun("admin"));
    expect(await sbg(admin, () => setStatusPengguna({ userId: saAkun.userId, aktif: false }))).toEqual(fail("TIDAK_DIIZINKAN"));
  });
});

describe("scripts/reset-password-superadmin.ts", () => {
  function jalankan(username: string) {
    return spawnSync(process.execPath, [`${akar}node_modules/tsx/dist/cli.mjs`, "--conditions=react-server", "scripts/reset-password-superadmin.ts"], {
      cwd: akar,
      encoding: "utf8",
      env: { ...process.env, RESET_SUPERADMIN_USERNAME: username },
    });
  }

  it("super_admin: password baru dicetak sekali, sesi dicabut; bukan super_admin / tidak ada -> gagal", async () => {
    const sa = await buatAkun("super_admin");
    const b = await masuk(sa);
    const r = jalankan(sa.username);
    expect(r.status, r.stderr).toBe(0);
    const password = /: ([A-Za-z0-9]{10})\n$/.exec(r.stdout)?.[1];
    expect(password).toBeDefined();
    expect(r.stdout.split(password!).length - 1).toBe(1);
    expect(await jumlahSesi(sa.userId)).toBe(0);
    expect(await sbg(b, () => requireAkses("getSesi"))).toEqual({ ok: false, hasil: fail("TIDAK_LOGIN") });
    const masukBaru = await masukDengan(sa.username, password!);
    expect(masukBaru.ok && masukBaru.data.mustChangePassword).toBe(true);

    const admin = await buatAkun("admin");
    const bukan = jalankan(admin.username);
    expect(bukan.status).toBe(1);
    expect(bukan.stderr).toContain("bukan super_admin");
    expect(jalankan(usernameAcak("zz")).stderr).toContain("tidak ditemukan");
  });
});
