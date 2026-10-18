// Impor akun nasabah dari JSON hasil scripts/ekstrak-nasabah.ts.
//
//   DATABASE_URL=<target> npx tsx --conditions=react-server scripts/impor-nasabah.ts <nasabah.json>
//       -> rencana saja (tidak menulis apa pun)
//   ... <nasabah.json> --tulis                     -> menulis ke DB lokal (localhost)
//   ... <nasabah.json> --tulis --izinkan-remote    -> menulis ke DB selain localhost (mis. Supabase)
//   ... --ambil-alih=0101,0102                     -> akun yang SUDAH ada dengan ID ini diganti nama
//                                                     dan di-reset ke password sementara baru; hanya
//                                                     bila role nasabah dan belum punya transaksi
//
// DATABASE_URL wajib di-set eksplisit (env auth lain dibaca dari .env.local). Jalankan mode rencana
// dulu dan pastikan angkanya benar sebelum --tulis.
// Akun dibuat lewat alur yang sama dengan buatPengguna di aplikasi: nama divalidasi skema kontrak
// (nama yang ditolak dilaporkan dan dilewati), password sementara acak, wajib ganti password saat
// login pertama. ID yang sudah ada dilewati, jadi aman dijalankan ulang.
// Password sementara ditulis ke .data/kredensial-nasabah-<host>-<waktu>.csv (folder .data di-ignore
// git): file baru tiap run, tidak pernah menimpa. Bagikan ke nasabah lewat jalur aman lalu hapus.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { eq, inArray, sql } from "drizzle-orm";
import { BuatPenggunaInputSchema } from "../contract";
import type { BarisNasabah } from "./ekstrak-nasabah";

// TANPA override: DATABASE_URL yang di-set eksplisit tetap dipakai.
config({ path: ".env.local", quiet: true });

/** "IBU ELVIRA" -> "Ibu Elvira". Hanya kapitalisasi dan spasi; isi nama tidak diubah. */
const rapikanNama = (n: string) =>
  n
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s.'])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

async function main() {
  const [file, ...flag] = process.argv.slice(2);
  if (!file) throw new Error("pakai: scripts/impor-nasabah.ts <nasabah.json> [--tulis] [--izinkan-remote] [--ambil-alih=ID,ID]");
  const tulis = flag.includes("--tulis");
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL wajib di-set eksplisit");
  const host = new URL(raw).hostname;
  const lokal = host === "localhost" || host === "127.0.0.1";
  if (tulis && !lokal && !flag.includes("--izinkan-remote")) throw new Error(`target ${host} bukan lokal; butuh --izinkan-remote`);

  const data = JSON.parse(readFileSync(file, "utf8")) as BarisNasabah[];
  const valid: { id: string; nama: string; rt: string }[] = [];
  const ditolak: string[] = [];
  for (const x of data) {
    const r = BuatPenggunaInputSchema.safeParse({ role: "nasabah", username: x.id, nama: rapikanNama(x.nama) });
    if (r.success) valid.push({ id: r.data.username, nama: r.data.nama, rt: x.rt });
    else ditolak.push(`${x.id} ${JSON.stringify(x.nama)}: ${r.error.issues[0].message}`);
  }

  const { db } = await import("../server/db");
  const { user } = await import("../server/db/auth-schema");
  const { transactions } = await import("../server/db/schema");
  const { buatPasswordSementara, buatPenggunaDenganPassword, resetKePasswordSementara } = await import("../server/pengguna");

  const ambilAlih = new Set(
    (flag.find((f) => f.startsWith("--ambil-alih="))?.split("=")[1] ?? "").split(",").filter(Boolean),
  );

  const adaRows = valid.length
    ? await db
        .select({ id: user.id, u: user.username, nama: user.name, role: user.role })
        .from(user)
        .where(inArray(user.username, valid.map((v) => v.id)))
    : [];
  const ada = new Map(adaRows.flatMap((r) => (r.u ? [[r.u, r] as const] : [])));
  const baru = valid.filter((v) => !ada.has(v.id));
  const alih: { v: (typeof valid)[number]; userId: string; namaLama: string }[] = [];
  for (const v of valid) {
    const a = ada.get(v.id);
    if (!a || !ambilAlih.has(v.id)) continue;
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(transactions)
      .where(eq(transactions.customerId, a.id));
    if (a.role !== "nasabah" || n > 0) throw new Error(`ambil alih ${v.id} ditolak: role=${a.role}, transaksi=${n}`);
    alih.push({ v, userId: a.id, namaLama: a.nama });
  }

  console.log(`target: ${host} | mode: ${tulis ? "TULIS" : "rencana saja"}`);
  console.log(
    `data: ${data.length} | lolos validasi: ${valid.length} | ditolak: ${ditolak.length} | sudah ada: ${ada.size} ` +
      `(diambil alih: ${alih.length}, dilewati: ${ada.size - alih.length}) | akan dibuat: ${baru.length}`,
  );
  for (const d of ditolak) console.log("  DITOLAK", d);
  for (const a of alih) console.log(`  AMBIL ALIH ${a.v.id}: "${a.namaLama}" -> "${a.v.nama}" + password sementara baru`);
  const lewat = [...ada.keys()].filter((k) => !ambilAlih.has(k));
  if (lewat.length) console.log("  DILEWATI (sudah ada):", lewat.sort().join(", "));
  if (!tulis) return;

  if (baru.length === 0 && alih.length === 0) {
    console.log("tidak ada akun baru / diambil alih; file kredensial tidak ditulis");
    return;
  }
  // File baru per run, dibuat SEBELUM menulis akun dan ditambah per baris: kalau run terhenti di
  // tengah, kredensial akun yang sudah terbuat tetap tersimpan.
  mkdirSync(".data", { recursive: true });
  const cap = new Date().toISOString().replace(/[:.]/g, "-");
  const out = `.data/kredensial-nasabah-${lokal ? "lokal" : host.split(".")[0]}-${cap}.csv`;
  writeFileSync(out, "rt,id_nasabah,nama,password_sementara\n", { encoding: "utf8", flag: "wx" });
  const catat = (v: (typeof valid)[number], pw: string) =>
    appendFileSync(out, `${v.rt},${v.id},"${v.nama.replace(/"/g, '""')}",${pw}\n`, "utf8");

  for (const a of alih) {
    await db.update(user).set({ name: a.v.nama }).where(eq(user.id, a.userId));
    catat(a.v, await resetKePasswordSementara(a.userId, a.v.id));
  }
  let dibuat = 0;
  for (const v of baru) {
    const password = buatPasswordSementara();
    await buatPenggunaDenganPassword({ username: v.id, nama: v.nama, role: "nasabah", password, mustChangePassword: true });
    catat(v, password);
    dibuat++;
  }
  console.log(`diambil alih: ${alih.length} | dibuat: ${dibuat} | kredensial: ${out}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("Impor gagal:", e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
