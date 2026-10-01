import { describe, expect, it } from "vitest";
import { LIMIT, normalisasiBerat } from "@/contract";
import { keNumberAman } from "@/server/angka";
import { mimeDariIsi } from "@/server/foto/validasi";
import { itemsKeJson } from "@/server/ledger";
import { bytesJpeg, bytesPng, bytesWebp } from "./foto";

/** "12.50" -> "12.5", "12.00" -> "12": bentuk desimal kanonis yang seharusnya ditulis JSON. */
const kanonis = (s: string) => s.replace(/0+$/, "").replace(/\.$/, "");

describe("berat string -> number -> JSON", () => {
  it("semua 0.01..10000.00 (langkah 0.01): JSON.stringify(Number(str)) sama persis dengan str dinormalisasi, tanpa notasi ilmiah", () => {
    const maksCenti = LIMIT.MAKS_BERAT_KG * 100;
    let diuji = 0;
    const gagal: string[] = [];
    for (let c = 1; c <= maksCenti; c++) {
      const str = `${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`;
      const json = JSON.stringify(Number(str));
      if (json !== kanonis(str) || /e/i.test(json)) gagal.push(`${str} -> ${json}`);
      // Bentuk masukan lain yang lolos zod kontrak ("12.5", "12") memberi angka yang sama.
      if (c % 10 === 0 && JSON.stringify(Number(kanonis(str))) !== json) gagal.push(`kanonis ${str}`);
      diuji++;
    }
    expect(diuji).toBe(1_000_000);
    expect(gagal).toEqual([]);
    expect(normalisasiBerat("12.5")).toBe("12.50");
  });

  it("itemsKeJson: id jenis di luar batas aman -> null", () => {
    expect(itemsKeJson([{ wasteTypeId: "7", berat: "0.1" }])).toBe('[{"waste_type_id":7,"berat":0.1}]');
    expect(itemsKeJson([{ wasteTypeId: "9007199254740993", berat: "1" }])).toBeNull();
  });
});

describe("keNumberAman (bigint string -> number)", () => {
  it("menerima bilangan aman, menolak di luar Number.MAX_SAFE_INTEGER / bukan bilangan", () => {
    expect(keNumberAman("0", "x")).toBe(0);
    expect(keNumberAman("-7500", "x")).toBe(-7500);
    expect(keNumberAman("9007199254740991", "x")).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => keNumberAman("9007199254740992", "x")).toThrow(/batas aman/);
    expect(() => keNumberAman("-9007199254740993", "x")).toThrow(/batas aman/);
    expect(() => keNumberAman("12.5", "x")).toThrow(/bukan bilangan bulat/);
    expect(() => keNumberAman("1e3", "x")).toThrow(/bukan bilangan bulat/);
  });
});

describe("magic bytes foto", () => {
  it("JPEG/PNG/WebP dikenali dari isi; teks & GIF tidak", () => {
    expect(mimeDariIsi(bytesJpeg())).toBe("image/jpeg");
    expect(mimeDariIsi(bytesPng())).toBe("image/png");
    expect(mimeDariIsi(bytesWebp())).toBe("image/webp");
    expect(mimeDariIsi(new TextEncoder().encode("GIF89a........"))).toBeNull();
    expect(mimeDariIsi(new TextEncoder().encode("hello"))).toBeNull();
    expect(mimeDariIsi(new Uint8Array(0))).toBeNull();
  });
});
