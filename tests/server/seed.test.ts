import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buatPasswordSementara } from "@/server/pengguna";
import { seedSuperAdmin } from "@/server/seed";
import { bukaKoneksi } from "../db/clients";
import { usernameAcak } from "./akun";
import { Browser, sebagai } from "./next-headers-mock";
import { login } from "@/server/api/actions";

const { owner } = bukaKoneksi();
const akar = fileURLToPath(new URL("../../", import.meta.url));

function jalankanSeed(username: string, nama: string) {
  return spawnSync(process.execPath, [`${akar}node_modules/tsx/dist/cli.mjs`, "scripts/seed-superadmin.ts"], {
    cwd: akar,
    encoding: "utf8",
    env: { ...process.env, SEED_SUPERADMIN_USERNAME: username, SEED_SUPERADMIN_NAMA: nama },
  });
}

/**
 * Seed menolak bila sudah ada super_admin, padahal DB tes berbagi data dengan tes lain.
 * super_admin yang ada diturunkan sementara ke admin lalu dikembalikan (file tes berjalan
 * berurutan, tidak ada tes lain yang berjalan bersamaan).
 */
async function tanpaSuperAdminLain<T>(fn: () => Promise<T>): Promise<T> {
  const turun = await owner`update public."user" set role = 'admin' where role = 'super_admin' returning id`;
  try {
    return await fn();
  } finally {
    const ids = turun.map((r) => r.id as string);
    if (ids.length) await owner`update public."user" set role = 'super_admin' where id = any(${ids})`;
  }
}

describe("password sementara", () => {
  it("10 karakter, crypto.randomInt, tanpa 0/O/1/l/I", () => {
    const semua = Array.from({ length: 2000 }, () => buatPasswordSementara());
    for (const p of semua) expect(p).toMatch(/^[A-HJ-NP-Za-km-z2-9]{10}$/);
    expect(new Set(semua).size).toBe(semua.length);
  });
});

describe("scripts/seed-superadmin.ts", () => {
  it("membuat super_admin, mencetak password SEKALI, mustChangePassword; kedua kali gagal", async () => {
    await tanpaSuperAdminLain(async () => {
      const username = usernameAcak("sa");
      const r = jalankanSeed(username, "Kepala Bank Sampah");
      expect(r.status, r.stderr).toBe(0);
      const cocok = /Password sementara .*: ([A-Za-z0-9]{10})\n$/.exec(r.stdout);
      expect(cocok).not.toBeNull();
      const password = cocok![1];
      expect(r.stdout.split(password).length - 1).toBe(1);
      expect(r.stderr).not.toContain(password);

      const [u] = await owner`
        select role, must_change_password, aktif, email, name from public."user" where username = ${username}`;
      expect({ ...u }).toEqual({
        role: "super_admin",
        must_change_password: true,
        aktif: true,
        email: `${username}@bank-sampah.invalid`,
        name: "Kepala Bank Sampah",
      });
      const [akun] = await owner`
        select a.password from public.account a join public."user" u on u.id = a.user_id
        where u.username = ${username} and a.provider_id = 'credential'`;
      expect(akun.password).not.toContain(password);

      const masuk = await sebagai(new Browser(), () => login({ username, password }));
      expect(masuk.ok && masuk.data).toMatchObject({ role: "super_admin", mustChangePassword: true });

      const ulang = jalankanSeed(usernameAcak("sb"), "Lain");
      expect(ulang.status).toBe(1);
      expect(ulang.stderr).toContain("Sudah ada super_admin");
      expect(ulang.stdout).toBe("");
    });
  });

  it("username sudah dipakai atau tidak sesuai kontrak -> gagal", async () => {
    await tanpaSuperAdminLain(async () => {
      const username = usernameAcak("dup");
      await owner`
        insert into public."user" (id, name, email, username, role)
        values (${username}, 'x', ${`${username}@test.local`}, ${username}, 'nasabah')`;
      await expect(seedSuperAdmin({ username, nama: "Dua" })).rejects.toThrow(/sudah dipakai/);
      await expect(seedSuperAdmin({ username: "AB", nama: "Dua" })).rejects.toThrow();
      await expect(seedSuperAdmin({ username: undefined, nama: "Dua" })).rejects.toThrow();
      const [r] = await owner`select count(*)::int as n from public."user" where role = 'super_admin'`;
      expect(r.n).toBe(0);
    });
  });
});
