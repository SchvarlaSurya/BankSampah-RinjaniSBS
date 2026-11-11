import { describe, expect, it } from "vitest";
import { computeStreak, geserTanggal, tanggalWib } from "@/lib/streak";

const HARI_INI = "2026-11-11";
const mundur = (n: number) => geserTanggal(HARI_INI, -n);

describe("computeStreak", () => {
  it("belum pernah masuk: semua 0", () => {
    const s = computeStreak([], HARI_INI);
    expect(s).toMatchObject({ current: 0, longest: 0, sudahMasukHariIni: false });
    expect(s.tujuhHari).toHaveLength(7);
    expect(s.tujuhHari.every((h) => !h.masuk)).toBe(true);
    expect(s.tujuhHari.at(-1)?.tanggal).toBe(HARI_INI);
    expect(s.tujuhHari[0].tanggal).toBe(mundur(6));
  });

  it("masuk hari ini setelah kemarin: bertambah 1, 2, 3", () => {
    expect(computeStreak([HARI_INI], HARI_INI).current).toBe(1);
    expect(computeStreak([mundur(1), HARI_INI], HARI_INI).current).toBe(2);
    expect(computeStreak([mundur(2), mundur(1), HARI_INI], HARI_INI)).toMatchObject({
      current: 3,
      longest: 3,
      sudahMasukHariIni: true,
    });
  });

  it("beberapa login dalam sehari dihitung satu hari", () => {
    const s = computeStreak([HARI_INI, HARI_INI, mundur(1), mundur(1), mundur(1)], HARI_INI);
    expect(s).toMatchObject({ current: 2, longest: 2 });
  });

  it("satu hari terlewat: streak berikutnya mulai dari 1, rekor tetap", () => {
    // 4 hari berturut, bolong kemarin, masuk hari ini.
    const s = computeStreak([mundur(5), mundur(4), mundur(3), mundur(2), HARI_INI], HARI_INI);
    expect(s).toMatchObject({ current: 1, longest: 4, sudahMasukHariIni: true });
  });

  it("hari ini belum masuk tapi kemarin masuk: streak belum putus", () => {
    const s = computeStreak([mundur(2), mundur(1)], HARI_INI);
    expect(s).toMatchObject({ current: 2, longest: 2, sudahMasukHariIni: false });
  });

  it("terakhir masuk 2 hari lalu: streak putus (0)", () => {
    const s = computeStreak([mundur(3), mundur(2)], HARI_INI);
    expect(s).toMatchObject({ current: 0, longest: 2, sudahMasukHariIni: false });
  });

  it("melewati batas bulan & tahun", () => {
    const s = computeStreak(["2026-12-30", "2026-12-31", "2027-01-01"], "2027-01-01");
    expect(s).toMatchObject({ current: 3, longest: 3 });
    expect(computeStreak(["2028-02-28", "2028-02-29", "2028-03-01"], "2028-03-01").current).toBe(3);
  });

  it("tanggal di masa depan diabaikan", () => {
    expect(computeStreak([HARI_INI, geserTanggal(HARI_INI, 1)], HARI_INI)).toMatchObject({ current: 1, longest: 1 });
  });

  it("7 hari terakhir menandai hari yang masuk", () => {
    const s = computeStreak([mundur(6), mundur(3), HARI_INI, mundur(30)], HARI_INI);
    expect(s.tujuhHari.map((h) => h.masuk)).toEqual([true, false, false, true, false, false, true]);
  });

  it("tanggal tidak valid ditolak", () => {
    expect(() => computeStreak(["11-11-2026"], HARI_INI)).toThrow();
  });
});

describe("tanggalWib", () => {
  it("batas hari = tengah malam WIB (UTC+7)", () => {
    expect(tanggalWib(new Date("2026-11-10T16:59:59Z"))).toBe("2026-11-10");
    expect(tanggalWib(new Date("2026-11-10T17:00:00Z"))).toBe("2026-11-11");
  });
});
