import { describe, expect, it } from "vitest";
import { fail } from "@/contract";
import { logout } from "@/server/api/actions";
import { getAktivitasAdmin } from "@/server/api/queries";
import { getKeepalive, getPresence, postPresence } from "@/server/aktivitas-admin-route";
import { bukaKoneksi } from "../db/clients";
import { buatAkun, masuk, sbg } from "./akun";
import { Browser } from "./next-headers-mock";

const { owner } = bukaKoneksi();

const hariIniWib = async () => {
  const [r] = await owner`select ((now() at time zone 'Asia/Jakarta')::date)::text as d`;
  return r.d as string;
};

async function hariLogin(userId: string) {
  return owner`select login_date::text as tanggal, count from public.admin_login_day where user_id = ${userId} order by login_date`;
}

const reqPresence = (body?: unknown, origin?: string) =>
  new Request("http://localhost:3000/api/admin/presence", {
    method: "POST",
    headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("pencatatan login harian", () => {
  it("admin: login dicatat sekali per hari WIB (UPSERT), count bertambah", async () => {
    const a = await buatAkun("admin");
    await masuk(a);
    await masuk(a);
    const baris = await hariLogin(a.userId);
    expect(baris).toEqual([{ tanggal: await hariIniWib(), count: 2 }]);
  });

  it("super_admin juga dicatat; nasabah TIDAK pernah dicatat", async () => {
    const sa = await buatAkun("super_admin");
    const n = await buatAkun("nasabah");
    await masuk(sa);
    const bn = await masuk(n);
    expect(await hariLogin(sa.userId)).toHaveLength(1);
    expect(await hariLogin(n.userId)).toHaveLength(0);
    // Heartbeat nasabah ditolak dan tetap tidak tercatat.
    const res = await sbg(bn, () => postPresence(reqPresence({ status: "online" })));
    expect(res.status).toBe(403);
    expect(await hariLogin(n.userId)).toHaveLength(0);
  });

  it("sesi lama (tanpa login ulang): heartbeat pertama hari itu membuat baris hari ini", async () => {
    const a = await buatAkun("admin");
    const b = await masuk(a);
    // Simulasikan: login terjadi kemarin, hari ini belum ada baris.
    await owner`update public.admin_login_day set login_date = login_date - 1 where user_id = ${a.userId}`;
    const res = await sbg(b, () => postPresence(reqPresence({ status: "online" })));
    expect(res.status).toBe(204);
    const hariIni = await hariIniWib();
    const baris = await hariLogin(a.userId);
    expect(baris.map((r) => r.tanggal)).toContain(hariIni);
    // Heartbeat bukan login: count hari ini 0, bukan bertambah.
    expect(baris.find((r) => r.tanggal === hariIni)?.count).toBe(0);
  });
});

describe("presence", () => {
  it("tanpa sesi -> 401; wajib ganti password -> 403", async () => {
    expect((await sbg(new Browser(), () => postPresence(reqPresence({ status: "online" })))).status).toBe(401);
    expect((await sbg(new Browser(), () => getPresence())).status).toBe(401);
    const a = await buatAkun("admin", { mustChangePassword: true });
    const b = await masuk(a);
    expect((await sbg(b, () => postPresence(reqPresence({ status: "online" })))).status).toBe(403);
  });

  it("Origin lintas situs ditolak; status tidak dikenal -> 400", async () => {
    const b = await masuk(await buatAkun("admin"));
    expect((await sbg(b, () => postPresence(reqPresence({ status: "online" }, "https://jahat.example")))).status).toBe(403);
    expect((await sbg(b, () => postPresence(reqPresence({ status: "aneh" })))).status).toBe(400);
  });

  it("heartbeat -> Sedang aktif; offline (sendBeacon) -> tidak aktif, lastSeenAt tetap", async () => {
    const a = await buatAkun("admin");
    const b = await masuk(a);
    expect((await sbg(b, () => postPresence(reqPresence({ status: "online" })))).status).toBe(204);
    const res = await sbg(b, () => getPresence());
    expect(res.status).toBe(200);
    const data = await res.json();
    const saya = data.tim.find((x: { id: string }) => x.id === a.userId);
    expect(saya).toMatchObject({ online: true, role: "admin" });
    expect(typeof data.serverNow).toBe("string");

    expect((await sbg(b, () => postPresence(reqPresence({ status: "offline" })))).status).toBe(204);
    const r2 = await sbg(b, () => getAktivitasAdmin());
    if (!r2.ok) throw new Error(r2.code);
    const lagi = r2.data.tim.find((x) => x.id === a.userId);
    expect(lagi?.online).toBe(false);
    expect(lagi?.lastSeenAt).toBe(saya.lastSeenAt);
  });

  it("heartbeat lebih dari 90 detik lalu dianggap tidak aktif", async () => {
    const a = await buatAkun("admin");
    const b = await masuk(a);
    await sbg(b, () => postPresence(reqPresence({ status: "online" })));
    await owner`update public.admin_presence set last_seen_at = now() - interval '91 seconds' where user_id = ${a.userId}`;
    const r = await sbg(b, () => getAktivitasAdmin());
    if (!r.ok) throw new Error(r.code);
    expect(r.data.tim.find((x) => x.id === a.userId)?.online).toBe(false);
  });

  it("logout menandai offline", async () => {
    const a = await buatAkun("admin");
    const b = await masuk(a);
    await sbg(b, () => postPresence(reqPresence({ status: "online" })));
    await sbg(b, () => logout());
    const [p] = await owner`select online_since from public.admin_presence where user_id = ${a.userId}`;
    expect(p.online_since).toBeNull();
  });
});

describe("getAktivitasAdmin: hak lihat streak ditegakkan di server", () => {
  it("nasabah ditolak", async () => {
    const b = await masuk(await buatAkun("nasabah"));
    expect(await sbg(b, () => getAktivitasAdmin())).toEqual(fail("TIDAK_DIIZINKAN"));
    expect((await sbg(b, () => getPresence())).status).toBe(403);
  });

  it("admin biasa: streak sendiri ada, streak admin lain null (tidak ada di payload)", async () => {
    const a = await buatAkun("admin");
    const lain = await buatAkun("admin");
    const ba = await masuk(a);
    await masuk(lain);
    const res = await sbg(ba, () => getPresence());
    const data = await res.json();
    const sendiri = data.tim.find((x: { id: string }) => x.id === a.userId);
    const orang = data.tim.find((x: { id: string }) => x.id === lain.userId);
    expect(sendiri.streak).toMatchObject({ current: 1, sudahMasukHariIni: true });
    expect(orang.streak).toBeNull();
    expect(data.saya).toMatchObject({ current: 1 });
    // Tidak ada tanggal login orang lain di mana pun dalam payload.
    expect(JSON.stringify(data.tim.filter((x: { id: string }) => x.id !== a.userId).map((x: { streak: unknown }) => x.streak)))
      .not.toContain("tanggal");
  });

  it("super_admin: streak semua staf terlihat, dihitung dari riwayat", async () => {
    const sa = await buatAkun("super_admin");
    const a = await buatAkun("admin");
    const bsa = await masuk(sa);
    await masuk(a);
    // Admin masuk 3 hari berturut-turut sampai hari ini, rekor lama 5 hari.
    await owner`
      insert into public.admin_login_day (user_id, login_date)
      select ${a.userId}, (now() at time zone 'Asia/Jakarta')::date - d
      from unnest(array[1, 2, 10, 11, 12, 13, 14]) as d`;
    const r = await sbg(bsa, () => getAktivitasAdmin());
    if (!r.ok) throw new Error(r.code);
    expect(r.data.tim.find((x) => x.id === a.userId)?.streak).toMatchObject({ current: 3, longest: 5 });
    expect(r.data.tim.find((x) => x.id === sa.userId)?.streak).toMatchObject({ current: 1 });
  });

  it("akun nonaktif tidak tampil di Tim Admin", async () => {
    const sa = await buatAkun("super_admin");
    const a = await buatAkun("admin");
    await owner`update public."user" set aktif = false where id = ${a.userId}`;
    const r = await sbg(await masuk(sa), () => getAktivitasAdmin());
    if (!r.ok) throw new Error(r.code);
    expect(r.data.tim.some((x) => x.id === a.userId)).toBe(false);
  });
});

describe("cron keepalive", () => {
  const req = (auth?: string) =>
    new Request("http://localhost:3000/api/cron/keepalive", { headers: auth ? { authorization: auth } : {} });

  it("tanpa / salah token -> 401, tidak menulis", async () => {
    const [sebelum] = await owner`select coalesce(max(jumlah_ping), 0)::int as n from public.system_keepalive`;
    expect((await getKeepalive(req())).status).toBe(401);
    expect((await getKeepalive(req("Bearer salah"))).status).toBe(401);
    expect((await getKeepalive(req("cron-tes-lokal-bukan-rahasia"))).status).toBe(401);
    const [sesudah] = await owner`select coalesce(max(jumlah_ping), 0)::int as n from public.system_keepalive`;
    expect(sesudah.n).toBe(sebelum.n);
  });

  it("token benar -> UPSERT satu baris, jumlah_ping bertambah", async () => {
    const r1 = await getKeepalive(req("Bearer cron-tes-lokal-bukan-rahasia"));
    expect(r1.status).toBe(200);
    const d1 = await r1.json();
    const r2 = await getKeepalive(req("Bearer cron-tes-lokal-bukan-rahasia"));
    const d2 = await r2.json();
    expect(d2.jumlahPing).toBe(d1.jumlahPing + 1);
    const [r] = await owner`select count(*)::int as n from public.system_keepalive`;
    expect(r.n).toBe(1);
  });
});
