// Impor master jenis sampah dari data/jenis-sampah-2026-09.json (hasil konversi Excel REKAP).
//   npm run seed:jenis-sampah              -> hanya menampilkan rencana, TIDAK menulis
//   npm run seed:jenis-sampah -- --tulis   -> menulis dalam satu transaksi
// Koneksi: DATABASE_URL dari .env.local / .env (role app_server cukup: INSERT/SELECT waste_types).
// Hanya satuan Kg (kontrak menghitung berat kg x harga per kg). Idempoten: dicocokkan dengan
// lower(btrim(nama)) seperti index unik waste_types_nama_unique. Jenis yang sudah ada TIDAK
// diubah; selisih harga hanya dilaporkan (ubah harga lewat halaman jenis sampah).
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import postgres from "postgres";
import { SimpanJenisSampahInputSchema } from "../contract";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const FILE_DATA = "data/jenis-sampah-2026-09.json";

interface BarisData {
  no: number;
  kategori: string;
  nama: string;
  satuan: string;
  hargaLapak: number;
  hargaSbs: number;
  keterangan: string | null;
}

const kunci = (nama: string) => nama.trim().toLowerCase();

async function main() {
  const tulis = process.argv.includes("--tulis");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tidak ada");

  const { jenisSampah } = JSON.parse(readFileSync(FILE_DATA, "utf8")) as { jenisSampah: BarisData[] };
  const dilewati = jenisSampah.filter((x) => x.satuan !== "Kg");
  const kandidat = jenisSampah
    .filter((x) => x.satuan === "Kg")
    .map((x) => {
      const input = { nama: x.nama, hargaBeli: x.hargaSbs, aktif: x.keterangan !== "Stop Sementara" };
      const parsed = SimpanJenisSampahInputSchema.safeParse(input);
      if (!parsed.success) throw new Error(`Baris no ${x.no} (${x.nama}) tidak valid: ${parsed.error.message}`);
      return parsed.data;
    });

  const u = new URL(url);
  console.log(`Target: ${u.username}@${u.host}${u.pathname} | mode: ${tulis ? "TULIS" : "rencana saja"}`);
  console.log(`Data: ${jenisSampah.length} baris, ${kandidat.length} Kg, ${dilewati.length} non-Kg dilewati`);

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    const ada = await sql<{ nama: string; harga_beli: number }[]>`
      select nama, harga_beli from public.waste_types`;
    const peta = new Map(ada.map((r) => [kunci(r.nama), r]));

    const baru = kandidat.filter((x) => !peta.has(kunci(x.nama)));
    const beda = kandidat.filter((x) => {
      const r = peta.get(kunci(x.nama));
      return r && r.harga_beli !== x.hargaBeli;
    });
    console.log(`Sudah ada: ${kandidat.length - baru.length} | baru: ${baru.length} | harga beda (tidak diubah): ${beda.length}`);
    for (const x of beda) console.log(`  beda harga: ${x.nama}: DB ${peta.get(kunci(x.nama))!.harga_beli}, Excel ${x.hargaBeli}`);

    if (!tulis || baru.length === 0) return;
    await sql.begin(async (tx) => {
      for (const x of baru) {
        await tx`insert into public.waste_types (nama, harga_beli, aktif)
                 values (${x.nama}, ${x.hargaBeli}, ${x.aktif})`;
      }
    });
    console.log(`Ditulis: ${baru.length} jenis sampah baru.`);
  } finally {
    await sql.end();
  }
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(`Seed jenis sampah gagal: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
