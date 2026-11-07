import { createHash, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSetorFormData, fail, LIMIT, type MutasiResult, type SetorInput } from "@/contract";
import { koreksi, setor, tarik } from "@/server/api/actions";
import { getTransaksi } from "@/server/api/queries";
import { fotoStorage } from "@/server/foto/storage";
import { bukaKoneksi } from "../db/clients";
import { buatJenis } from "../db/factories";
import { type Akun, buatAkun, masuk, sbg, tangkapLog } from "./akun";
import { bytesJpeg, bytesPng, bytesWebp, fileFoto, isiDirFoto } from "./foto";
import { Browser } from "./next-headers-mock";

const { owner } = bukaKoneksi();

interface Konteks {
  nasabah: Akun;
  admin: Browser;
  adminAkun: Akun;
  superAdmin: Browser;
  jenis: string; // Rp3000/kg
}

let k: Konteks;
beforeEach(async () => {
  const adminAkun = await buatAkun("admin");
  k = {
    nasabah: await buatAkun("nasabah"),
    adminAkun,
    admin: await masuk(adminAkun),
    superAdmin: await masuk(await buatAkun("super_admin")),
    jenis: await buatJenis(owner, 3000),
  };
});

function formSetor(ubah: Partial<SetorInput> = {}, foto: File | null = fileFoto(bytesJpeg())) {
  const input: SetorInput = {
    customerId: k.nasabah.userId,
    items: [{ wasteTypeId: k.jenis, berat: "2.5" }],
    catatan: "pagi",
    clientRequestId: randomUUID(),
    ...ubah,
  };
  if (foto) return buildSetorFormData(input, foto);
  const fd = new FormData();
  fd.append("payload", JSON.stringify(input));
  return fd;
}

const tanpaFoto = <T extends { fotoUrl: unknown; fotoUrlBerlakuHingga: unknown }>(d: T) => ({
  ...d,
  fotoUrl: null,
  fotoUrlBerlakuHingga: null,
});

async function barisTransaksi(id: string) {
  const [r] = await owner`select path_foto, hash_foto, jumlah from public.transactions where id = ${id}`;
  return r;
}

describe("setor (FormData + foto)", () => {
  it("sukses: MutasiResult lengkap, TransaksiDetail sama dengan getTransaksi, foto tersimpan + hash SHA-256", async () => {
    const bytes = bytesJpeg();
    const sebelum = await isiDirFoto();
    const hasil = await sbg(k.admin, () => setor(formSetor({}, fileFoto(bytes))));
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    const { transaksi, saldoBaru, duplikat } = hasil.data;
    expect({ saldoBaru, duplikat }).toEqual({ saldoBaru: 7500, duplikat: false });
    expect(transaksi).toEqual({
      id: expect.stringMatching(/^\d+$/),
      tipe: "setor",
      jumlah: 7500,
      waktu: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/),
      catatan: "pagi",
      dibuatOlehNama: "Tes admin",
      sudahDibalik: false,
      membalikId: null,
      customerId: k.nasabah.userId,
      customerNama: "Tes nasabah",
      customerUsername: k.nasabah.username,
      dibuatOlehId: k.adminAkun.userId,
      items: [{ wasteTypeId: k.jenis, namaSampah: expect.any(String), berat: "2.50", hargaSnapshot: 3000, subtotal: 7500 }],
      dibalikOlehId: null,
      fotoUrl: null, // admin tidak mendapat fotoUrl
      fotoUrlBerlakuHingga: null,
    });

    expect(await sbg(k.admin, () => getTransaksi({ id: transaksi.id }))).toEqual({ ok: true, data: transaksi });

    const sesudah = await isiDirFoto();
    expect(sesudah.length).toBe(sebelum.length + 1);
    const db = await barisTransaksi(transaksi.id);
    expect(sesudah).toContain(db.path_foto);
    expect(db.path_foto).toMatch(/^[a-f0-9-]{36}\.jpg$/);
    expect(db.hash_foto).toBe(createHash("sha256").update(bytes).digest("hex"));
  });

  it("super_admin mendapat fotoUrl bertanda tangan berumur pendek; PNG & WebP diterima", async () => {
    const png = await sbg(k.superAdmin, () => setor(formSetor({}, fileFoto(bytesPng(), "image/png", "a.png"))));
    expect(png.ok).toBe(true);
    if (!png.ok) return;
    expect(png.data.transaksi.fotoUrl).toMatch(/^\/api\/dev-foto\/[a-f0-9-]{36}\.png\?exp=\d+&sig=[a-f0-9]{64}$/);
    const umur = Date.parse(png.data.transaksi.fotoUrlBerlakuHingga!) - Date.now();
    expect(umur).toBeGreaterThan(250_000);
    expect(umur).toBeLessThanOrEqual(300_000);
    const lagi = await sbg(k.superAdmin, () => getTransaksi({ id: png.data.transaksi.id }));
    expect(lagi.ok && tanpaFoto(lagi.data)).toEqual(tanpaFoto(png.data.transaksi));

    const webp = await sbg(k.superAdmin, () => setor(formSetor({}, fileFoto(bytesWebp(), "image/webp", "a.webp"))));
    expect(webp.ok && webp.data.transaksi.fotoUrl).toMatch(/\.webp\?/);
  });

  it("retry dengan clientRequestId sama (foto lain): duplikat=true, transaksi asli, TIDAK ada file foto kedua", async () => {
    const uuid = randomUUID();
    const asli = await sbg(k.admin, () => setor(formSetor({ clientRequestId: uuid })));
    if (!asli.ok) throw new Error(asli.code);
    const dir1 = await isiDirFoto();

    await sbg(k.admin, () => tarik({ customerId: k.nasabah.userId, jumlah: 500, clientRequestId: randomUUID() }));
    const ulang = await sbg(k.admin, () => setor(formSetor({ clientRequestId: uuid, items: [{ wasteTypeId: k.jenis, berat: "9" }] })));
    expect(ulang.ok).toBe(true);
    if (!ulang.ok) return;
    expect(ulang.data.duplikat).toBe(true);
    expect(ulang.data.saldoBaru).toBe(7000); // saldo SAAT INI
    expect(ulang.data.transaksi).toEqual(asli.data.transaksi);
    expect(await isiDirFoto()).toEqual(dir1);
    expect(dir1).toContain((await barisTransaksi(asli.data.transaksi.id)).path_foto);
  });

  it("retry PARALEL dengan clientRequestId sama: satu transaksi, satu duplikat, hanya satu file tersisa", async () => {
    for (let i = 0; i < 5; i++) {
      const uuid = randomUUID();
      const sebelum = await isiDirFoto();
      const hasil = await Promise.all([1, 2].map(() => sbg(k.admin, () => setor(formSetor({ clientRequestId: uuid })))));
      const ok = hasil.filter((h): h is { ok: true; data: MutasiResult } => h.ok);
      expect(ok).toHaveLength(2);
      expect(ok.map((h) => h.data.duplikat).sort()).toEqual([false, true]);
      expect(ok[0].data.transaksi.id).toBe(ok[1].data.transaksi.id);
      const sesudah = await isiDirFoto();
      expect(sesudah.length).toBe(sebelum.length + 1);
      expect(sesudah).toContain((await barisTransaksi(ok[0].data.transaksi.id)).path_foto);
    }
  });

  it("foto palsu / jenis tidak cocok / terlalu besar -> FOTO_TIDAK_VALID; tanpa foto -> FOTO_WAJIB; tidak ada file tersisa", async () => {
    const sebelum = await isiDirFoto();
    const teks = new TextEncoder().encode("ini bukan gambar, cuma teks");
    const kasus: [File | null, string][] = [
      [fileFoto(teks, "image/jpeg", "timbangan.jpg"), "FOTO_TIDAK_VALID"],
      [fileFoto(bytesJpeg(), "image/png", "a.png"), "FOTO_TIDAK_VALID"],
      [fileFoto(bytesJpeg(), "image/gif", "a.gif"), "FOTO_TIDAK_VALID"],
      [fileFoto(bytesJpeg(LIMIT.FOTO_MAKS_BYTES), "image/jpeg"), "FOTO_TIDAK_VALID"],
      [null, "FOTO_WAJIB"],
      [fileFoto(new Uint8Array(0)), "FOTO_WAJIB"],
    ];
    for (const [foto, kode] of kasus) {
      const h = await sbg(k.admin, () => setor(formSetor({}, foto)));
      expect(h.ok || h.code).toBe(kode);
    }
    expect(await isiDirFoto()).toEqual(sebelum);
  });

  it("payload tidak valid -> VALIDASI_GAGAL (sebelum foto diperiksa)", async () => {
    const rusak = new FormData();
    rusak.append("payload", "{bukan json");
    rusak.append("foto", fileFoto(bytesJpeg()));
    const h1 = await sbg(k.admin, () => setor(rusak));
    expect(!h1.ok && h1.code).toBe("VALIDASI_GAGAL");
    const h2 = await sbg(k.admin, () => setor(formSetor({ items: [{ wasteTypeId: k.jenis, berat: "1.234" }] }, null)));
    expect(!h2.ok && h2.code).toBe("VALIDASI_GAGAL");
    expect(!h2.ok && Object.keys(h2.fieldErrors ?? {})).toEqual(["items.0.berat"]);
  });

  it("foto byte-identik dua kali -> FOTO_SUDAH_DIPAKAI dan file kedua terhapus; boleh lagi setelah dikoreksi", async () => {
    const bytes = bytesJpeg();
    const pertama = await sbg(k.admin, () => setor(formSetor({}, fileFoto(bytes))));
    if (!pertama.ok) throw new Error(pertama.code);
    const dir = await isiDirFoto();
    expect(await sbg(k.admin, () => setor(formSetor({}, fileFoto(bytes))))).toEqual(fail("FOTO_SUDAH_DIPAKAI"));
    expect(await isiDirFoto()).toEqual(dir);

    await sbg(k.superAdmin, () => koreksi({ transaksiId: pertama.data.transaksi.id, alasan: "foto transaksi lain", clientRequestId: randomUUID() }));
    expect((await sbg(k.admin, () => setor(formSetor({}, fileFoto(bytes))))).ok).toBe(true);
  });

  it("kode error SQL lewat action (file baru selalu dihapus)", async () => {
    const sebelum = await isiDirFoto();
    const murah = await buatJenis(owner, 10);
    const nonaktifJenis = await buatJenis(owner, 500, { aktif: false });
    const cek = async (ubah: Partial<SetorInput>, kode: string) => {
      const h = await sbg(k.admin, () => setor(formSetor(ubah)));
      expect(h.ok || h.code).toBe(kode);
    };
    await cek({ items: [{ wasteTypeId: murah, berat: "0.01" }] }, "ITEM_TERLALU_KECIL");
    await cek({ items: [{ wasteTypeId: nonaktifJenis, berat: "1" }] }, "JENIS_SAMPAH_TIDAK_VALID");
    await cek({ items: [{ wasteTypeId: "900000000000", berat: "1" }] }, "JENIS_SAMPAH_TIDAK_VALID");
    await cek({ items: [{ wasteTypeId: "999999999999999999", berat: "1" }] }, "JENIS_SAMPAH_TIDAK_VALID");
    await cek({ customerId: k.adminAkun.userId }, "NASABAH_TIDAK_DITEMUKAN");
    await owner`update public."user" set aktif = false where id = ${k.nasabah.userId}`;
    await cek({}, "NASABAH_NONAKTIF");
    expect(await isiDirFoto()).toEqual(sebelum);

    const nasabah = await masuk(await buatAkun("nasabah"));
    expect(await sbg(nasabah, () => setor(formSetor()))).toEqual(fail("TIDAK_DIIZINKAN"));
  });
});

describe("tarik", () => {
  it("sukses, retry duplikat, SALDO_TIDAK_CUKUP, nasabah nonaktif boleh, validasi & akses", async () => {
    await sbg(k.admin, () => setor(formSetor()));
    const uuid = randomUUID();
    const h = await sbg(k.admin, () => tarik({ customerId: k.nasabah.userId, jumlah: 2500, catatan: "", clientRequestId: uuid }));
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.data).toMatchObject({ saldoBaru: 5000, duplikat: false });
    expect(h.data.transaksi).toMatchObject({ tipe: "tarik", jumlah: -2500, items: [], catatan: null, fotoUrl: null });
    expect(await sbg(k.admin, () => getTransaksi({ id: h.data.transaksi.id }))).toEqual({ ok: true, data: h.data.transaksi });

    const ulang = await sbg(k.admin, () => tarik({ customerId: k.nasabah.userId, jumlah: 2500, clientRequestId: uuid }));
    expect(ulang.ok && ulang.data).toMatchObject({ duplikat: true, saldoBaru: 5000, transaksi: { id: h.data.transaksi.id } });

    expect(await sbg(k.admin, () => tarik({ customerId: k.nasabah.userId, jumlah: 5001, clientRequestId: randomUUID() }))).toEqual(
      fail("SALDO_TIDAK_CUKUP"),
    );
    await owner`update public."user" set aktif = false where id = ${k.nasabah.userId}`;
    const habis = await sbg(k.superAdmin, () => tarik({ customerId: k.nasabah.userId, jumlah: 5000, clientRequestId: randomUUID() }));
    expect(habis.ok && habis.data.saldoBaru).toBe(0);

    const nol = await sbg(k.admin, () => tarik({ customerId: k.nasabah.userId, jumlah: 0, clientRequestId: randomUUID() }));
    expect(!nol.ok && nol.code).toBe("VALIDASI_GAGAL");
    expect(await sbg(k.admin, () => tarik({ customerId: "tidak-ada", jumlah: 1, clientRequestId: randomUUID() }))).toEqual(
      fail("NASABAH_TIDAK_DITEMUKAN"),
    );
    const n = await masuk(await buatAkun("nasabah"));
    expect(await sbg(n, () => tarik({ customerId: k.nasabah.userId, jumlah: 1, clientRequestId: randomUUID() }))).toEqual(
      fail("TIDAK_DIIZINKAN"),
    );
  });

  it("dua tarik PARALEL lewat action, total > saldo: tepat satu sukses", async () => {
    await sbg(k.admin, () => setor(formSetor({ items: [{ wasteTypeId: k.jenis, berat: "1" }] })));
    const hasil = await Promise.all(
      [1, 2].map(() => sbg(k.admin, () => tarik({ customerId: k.nasabah.userId, jumlah: 2000, clientRequestId: randomUUID() }))),
    );
    expect(hasil.map((h) => (h.ok ? "OK" : h.code)).sort()).toEqual(["OK", "SALDO_TIDAK_CUKUP"]);
  });
});

describe("koreksi", () => {
  it("super_admin membalik setor; detail asli & koreksi saling menunjuk; semua kode error koreksi", async () => {
    const s = await sbg(k.admin, () => setor(formSetor()));
    if (!s.ok) throw new Error(s.code);
    const id = s.data.transaksi.id;
    const uuid = randomUUID();
    const kor = await sbg(k.superAdmin, () => koreksi({ transaksiId: id, alasan: "salah timbang", clientRequestId: uuid }));
    expect(kor.ok).toBe(true);
    if (!kor.ok) return;
    expect(kor.data).toMatchObject({ saldoBaru: 0, duplikat: false });
    expect(kor.data.transaksi).toMatchObject({ tipe: "koreksi", jumlah: -7500, membalikId: id, catatan: "salah timbang", customerId: k.nasabah.userId });
    const asli = await sbg(k.superAdmin, () => getTransaksi({ id }));
    expect(asli.ok && asli.data).toMatchObject({ sudahDibalik: true, dibalikOlehId: kor.data.transaksi.id });

    const ulang = await sbg(k.superAdmin, () => koreksi({ transaksiId: id, alasan: "salah timbang", clientRequestId: uuid }));
    expect(ulang.ok && ulang.data.duplikat).toBe(true);

    const r = () => randomUUID();
    expect(await sbg(k.superAdmin, () => koreksi({ transaksiId: id, alasan: "lagi lagi", clientRequestId: r() }))).toEqual(fail("TRANSAKSI_SUDAH_DIBALIK"));
    expect(await sbg(k.superAdmin, () => koreksi({ transaksiId: kor.data.transaksi.id, alasan: "lagi lagi", clientRequestId: r() }))).toEqual(
      fail("TRANSAKSI_TIDAK_BISA_DIBALIK"),
    );
    expect(await sbg(k.superAdmin, () => koreksi({ transaksiId: "900000000000", alasan: "tidak ada", clientRequestId: r() }))).toEqual(
      fail("TRANSAKSI_TIDAK_DITEMUKAN"),
    );

    const s2 = await sbg(k.admin, () => setor(formSetor()));
    if (!s2.ok) throw new Error(s2.code);
    await sbg(k.admin, () => tarik({ customerId: k.nasabah.userId, jumlah: 7000, clientRequestId: r() }));
    expect(await sbg(k.superAdmin, () => koreksi({ transaksiId: s2.data.transaksi.id, alasan: "uang sudah ditarik", clientRequestId: r() }))).toEqual(
      fail("KOREKSI_MEMBUAT_SALDO_MINUS"),
    );
    expect(await sbg(k.admin, () => koreksi({ transaksiId: s2.data.transaksi.id, alasan: "admin coba", clientRequestId: r() }))).toEqual(
      fail("TIDAK_DIIZINKAN"),
    );
    const pendek = await sbg(k.superAdmin, () => koreksi({ transaksiId: s2.data.transaksi.id, alasan: "ab", clientRequestId: r() }));
    expect(!pendek.ok && pendek.code).toBe("VALIDASI_GAGAL");
  });
});

describe("kode umum lewat lapisan action", () => {
  it("mustChangePassword -> WAJIB_GANTI_PASSWORD pada setor/tarik/koreksi", async () => {
    const b = await masuk(await buatAkun("super_admin", { mustChangePassword: true }));
    const r = () => randomUUID();
    expect(await sbg(b, () => setor(formSetor()))).toEqual(fail("WAJIB_GANTI_PASSWORD"));
    expect(await sbg(b, () => tarik({ customerId: k.nasabah.userId, jumlah: 1, clientRequestId: r() }))).toEqual(fail("WAJIB_GANTI_PASSWORD"));
    expect(await sbg(b, () => koreksi({ transaksiId: "1", alasan: "apa saja", clientRequestId: r() }))).toEqual(fail("WAJIB_GANTI_PASSWORD"));
  });

  it("kegagalan tak terduga -> SERVER_ERROR (tanpa throw); log tidak memuat nama file foto", async () => {
    const storage = fotoStorage();
    const spy = vi.spyOn(storage, "simpan").mockRejectedValueOnce(new Error("disk penuh"));
    const log = tangkapLog();
    let hasil: Awaited<ReturnType<typeof setor>>;
    try {
      hasil = await sbg(k.admin, () => setor(formSetor()));
    } finally {
      log.pulihkan();
      spy.mockRestore();
    }
    expect(hasil).toEqual(fail("SERVER_ERROR"));
    const semua = log.pesan.join("\n");
    expect(semua).toContain("[setor]");
    expect(semua).toContain("disk penuh");
    expect(semua).not.toMatch(/[a-f0-9-]{36}\.jpg/);
  });
});
