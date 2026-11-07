// Ekstrak data nasabah dari file Excel daftar nasabah (satu sheet per RT) ke JSON untuk impor-nasabah.ts.
//
// 1. Simpan tiap sheet "RT 01" ... "RT 13" sebagai CSV (Excel: Save As -> CSV UTF-8, pemisah ";")
//    ke satu folder, dengan nama yang memuat nomor RT, mis. "sheet-RT_01.csv".
// 2. npx tsx scripts/ekstrak-nasabah.ts <folder-csv> <keluaran.json>
//
// Baris header dicari lewat kolom "NO ID"; kolom NAMA, ALAMAT, TLP opsional. Slot ID tanpa nama
// dilewati. ID harus 4 digit dan diawali nomor RT sheet-nya (dilaporkan bila tidak).
// Data nasabah adalah data pribadi: simpan keluaran di .data/ (di-ignore git), jangan di-commit.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type BarisNasabah = { rt: string; id: string; nama: string; alamat: string; tlp: string; baris: number };

/** Parser CSV sederhana (pemisah ";", kutip ganda ala Excel). */
function parseCsv(teks: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let sel = "";
  let kutip = false;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (kutip) {
      if (c === '"' && teks[i + 1] === '"') {
        sel += '"';
        i++;
      } else if (c === '"') kutip = false;
      else sel += c;
    } else if (c === '"') kutip = true;
    else if (c === ";") {
      row.push(sel);
      sel = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && teks[i + 1] === "\n") i++;
      row.push(sel);
      rows.push(row);
      row = [];
      sel = "";
    } else sel += c;
  }
  if (sel || row.length) rows.push([...row, sel]);
  return rows;
}

function main() {
  const [dir, out] = process.argv.slice(2);
  if (!dir || !out) throw new Error("pakai: npx tsx scripts/ekstrak-nasabah.ts <folder-csv> <keluaran.json>");

  const hasil: BarisNasabah[] = [];
  const anomali: string[] = [];
  const files = readdirSync(dir)
    .filter((f) => /RT[\s_.-]*\d+.*\.csv$/i.test(f))
    .sort();
  if (files.length === 0) throw new Error(`tidak ada CSV sheet RT di ${dir}`);

  for (const f of files) {
    const rt = f.match(/RT[\s_.-]*(\d+)/i)![1].padStart(2, "0");
    const rows = parseCsv(readFileSync(path.join(dir, f), "utf8").replace(/^﻿/, ""));
    const hdrIdx = rows.findIndex((r) => r.some((c) => c.trim().toUpperCase() === "NO ID"));
    if (hdrIdx < 0) {
      anomali.push(`${f}: header "NO ID" tidak ditemukan`);
      continue;
    }
    const hdr = rows[hdrIdx].map((c) => c.trim().toUpperCase());
    const kol = (k: string) => hdr.indexOf(k);
    rows.slice(hdrIdx + 1).forEach((r, i) => {
      const ambil = (k: string) => (kol(k) >= 0 ? (r[kol(k)] ?? "").trim() : "");
      const id = ambil("NO ID");
      const nama = ambil("NAMA");
      if (!nama) return; // slot nomor yang belum terisi / baris kosong
      const rec = { rt, id, nama, alamat: ambil("ALAMAT"), tlp: ambil("TLP"), baris: hdrIdx + i + 2 };
      if (!/^\d{4}$/.test(id)) return void anomali.push(`RT ${rt} baris ${rec.baris}: ID "${id}" bukan 4 digit (dilewati)`);
      if (!id.startsWith(rt)) anomali.push(`RT ${rt} baris ${rec.baris}: ID ${id} tidak diawali nomor RT`);
      hasil.push(rec);
    });
  }

  const hitung = new Map<string, number>();
  for (const x of hasil) hitung.set(x.id, (hitung.get(x.id) ?? 0) + 1);
  const dobel = [...hitung].filter(([, n]) => n > 1).map(([id]) => id);

  writeFileSync(out, JSON.stringify(hasil, null, 1), "utf8");
  const perRt = [...new Set(hasil.map((x) => x.rt))]
    .sort()
    .map((rt) => `${rt}:${hasil.filter((x) => x.rt === rt).length}`)
    .join(" ");
  console.log(`sheet: ${files.length} | nasabah: ${hasil.length} | per RT: ${perRt}`);
  console.log(`ID dobel: ${dobel.length ? dobel.join(", ") : "-"}`);
  for (const a of anomali) console.log("  ANOMALI", a);
  console.log(`keluaran: ${out}`);
}

main();
