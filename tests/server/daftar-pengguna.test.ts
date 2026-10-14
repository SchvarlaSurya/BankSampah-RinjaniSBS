import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fail } from "@/contract";
import { getLatestIdByRt } from "@/server/api/actions";
import { listPengguna } from "@/server/api/queries";
import { bukaKoneksi } from "../db/clients";
import { buatAkun, masuk, sbg } from "./akun";

const { owner } = bukaKoneksi();

/** RT 2 digit yang belum dipakai tes lain (username acak tes lain diawali huruf). */
async function rtKosong(): Promise<string> {
  for (;;) {
    const rt = String(10 + Math.floor(Math.random() * 90));
    const [r] = await owner`select count(*)::int as n from public."user" where username like ${`${rt}%`}`;
    if (r.n === 0) return rt;
  }
}

describe("listPengguna", () => {
  it("super_admin: filter role, RT, aktif, cari (username/nama, % di-escape), halaman + total", async () => {
    const sa = await masuk(await buatAkun("super_admin"));
    const rt = await rtKosong();
    const tanda = randomBytes(3).toString("hex");
    const n1 = await buatAkun("nasabah", { username: `${rt}01`, nama: `Warga ${tanda} Satu` });
    const n2 = await buatAkun("nasabah", { username: `${rt}02`, nama: `Warga ${tanda} Dua` });
    await owner`update public."user" set aktif = false where id = ${n2.userId}`;

    const perRt = await sbg(sa, () => listPengguna({ role: "nasabah", rt }));
    if (!perRt.ok) throw new Error(perRt.code);
    expect(perRt.data).toMatchObject({ total: 2, limit: 20, offset: 0 });
    expect(perRt.data.items).toEqual([
      {
        id: n1.userId,
        username: `${rt}01`,
        nama: `Warga ${tanda} Satu`,
        role: "nasabah",
        aktif: true,
        rt,
        mustChangePassword: false,
        createdAt: expect.stringMatching(/Z$/),
      },
      expect.objectContaining({ id: n2.userId, aktif: false, rt }),
    ]);

    const aktif = await sbg(sa, () => listPengguna({ rt, aktif: true }));
    expect(aktif.ok && aktif.data.items.map((u) => u.id)).toEqual([n1.userId]);
    const cari = await sbg(sa, () => listPengguna({ search: `${tanda} dua` }));
    expect(cari.ok && cari.data.items.map((u) => u.id)).toEqual([n2.userId]);
    const halaman2 = await sbg(sa, () => listPengguna({ rt, limit: 1, offset: 1 }));
    expect(halaman2.ok && halaman2.data).toMatchObject({ total: 2, items: [{ id: n2.userId }] });
    const persen = await sbg(sa, () => listPengguna({ search: `${tanda}%` }));
    expect(persen.ok && persen.data.total).toBe(0);

    const staf = await sbg(sa, () => listPengguna({ role: "admin", limit: 100 }));
    expect(staf.ok && staf.data.items.every((u) => u.role === "admin" && u.rt === null)).toBe(true);
  });

  it("admin dipaksa hanya melihat nasabah; nasabah ditolak; input salah -> VALIDASI_GAGAL", async () => {
    const admin = await masuk(await buatAkun("admin"));
    const h = await sbg(admin, () => listPengguna({ role: "super_admin", limit: 100 }));
    if (!h.ok) throw new Error(h.code);
    expect(h.data.items.length).toBeGreaterThan(0);
    expect(h.data.items.every((u) => u.role === "nasabah")).toBe(true);

    const nasabah = await masuk(await buatAkun("nasabah"));
    expect(await sbg(nasabah, () => listPengguna())).toEqual(fail("TIDAK_DIIZINKAN"));
    const salah = await sbg(admin, () => listPengguna({ rt: "1a", limit: 0 }));
    expect(!salah.ok && Object.keys(salah.fieldErrors ?? {}).sort()).toEqual(["limit", "rt"]);
  });
});

describe("getLatestIdByRt", () => {
  it("nomor urut berikutnya dari nasabah di RT itu (staf & pola lain diabaikan), RT 1 digit dipad", async () => {
    const admin = await masuk(await buatAkun("admin"));
    const rt = await rtKosong();
    expect(await sbg(admin, () => getLatestIdByRt({ rtNumber: rt }))).toEqual({
      ok: true,
      data: { nextId: `${rt}01`, rt, count: 0 },
    });

    await buatAkun("nasabah", { username: `${rt}01` });
    await buatAkun("nasabah", { username: `${rt}07` });
    await buatAkun("nasabah", { username: `${rt}ab` });
    await buatAkun("admin", { username: `${rt}99` });
    expect(await sbg(admin, () => getLatestIdByRt({ rtNumber: rt }))).toEqual({
      ok: true,
      data: { nextId: `${rt}08`, rt, count: 7 },
    });

    const satuDigit = await sbg(admin, () => getLatestIdByRt({ rtNumber: "7" }));
    expect(satuDigit.ok && satuDigit.data.rt).toBe("07");
    const salah = await sbg(admin, () => getLatestIdByRt({ rtNumber: "RT1" }));
    expect(!salah.ok && salah.code).toBe("VALIDASI_GAGAL");
    const nasabah = await masuk(await buatAkun("nasabah"));
    expect(await sbg(nasabah, () => getLatestIdByRt({ rtNumber: rt }))).toEqual(fail("TIDAK_DIIZINKAN"));
  });
});
