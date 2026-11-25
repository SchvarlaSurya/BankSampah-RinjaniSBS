"use client";

import { useEffect, useState } from "react";
import { Flame, Trophy, Users } from "lucide-react";
import { type AktivitasAdmin, type AnggotaTimAdmin, PRESENCE, type StreakInfo, ZONA_WAKTU } from "@/contract";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { geserTanggal, tanggalWib } from "@/lib/streak";
import { cn } from "@/lib/utils";

const MAKS_API = 7;

/** "14:05" (jam:menit, 24 jam, WIB). */
function jamMenit(waktu: Date, detik = false): string {
  const bagian = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA_WAKTU,
    hour: "2-digit",
    minute: "2-digit",
    ...(detik ? { second: "2-digit" } : {}),
    hourCycle: "h23",
  }).formatToParts(waktu);
  const ambil = (t: string) => bagian.find((b) => b.type === t)?.value ?? "00";
  return detik ? `${ambil("hour")}:${ambil("minute")}:${ambil("second")}` : `${ambil("hour")}:${ambil("minute")}`;
}

const namaHari = (tanggal: string) =>
  new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" }).format(new Date(`${tanggal}T00:00:00Z`));

const tanggalPendek = (tanggal: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${tanggal}T00:00:00Z`));

function teksStatus(a: AnggotaTimAdmin, hariIni: string): string {
  if (a.online) return "Sedang aktif";
  if (!a.lastSeenAt) return "Belum pernah aktif";
  const waktu = new Date(a.lastSeenAt);
  const tgl = tanggalWib(waktu);
  const jam = `${jamMenit(waktu)} WIB`;
  if (tgl === hariIni) return `Terakhir aktif ${jam}`;
  if (tgl === geserTanggal(hariIni, -1)) return `Terakhir aktif kemarin, ${jam}`;
  return `Terakhir aktif ${tanggalPendek(tgl)}, ${jam}`;
}

/** Ikon api sebanyak min(streak, 7). */
function BarisApi({ jumlah, kecil = false }: { jumlah: number; kecil?: boolean }) {
  const n = Math.min(jumlah, MAKS_API);
  if (n === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-accent-warm" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <Flame key={i} className={kecil ? "size-4" : "size-6"} strokeWidth={2} fill="currentColor" fillOpacity={0.25} />
      ))}
    </span>
  );
}

function TujuhHari({ streak, hariIni }: { streak: StreakInfo; hariIni: string }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label="Kehadiran 7 hari terakhir">
      {streak.tujuhHari.map((h) => (
        <li key={h.tanggal} className="flex flex-col items-center gap-1">
          <span className={cn("text-sm", h.tanggal === hariIni ? "font-semibold text-ink" : "text-ink-muted")}>
            {namaHari(h.tanggal)}
          </span>
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-full text-sm font-semibold",
              h.masuk ? "bg-accent-warm text-on-accent-warm" : "bg-surface-muted text-ink-subtle ring-1 ring-line ring-inset",
            )}
          >
            {h.masuk ? <Flame className="size-4" aria-hidden="true" /> : <span aria-hidden="true">–</span>}
            <span className="sr-only">
              {namaHari(h.tanggal)} {tanggalPendek(h.tanggal)}: {h.masuk ? "masuk" : "tidak masuk"}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Jam WIB berjalan dari jam server. Dirender setelah mount (tanpa hydration mismatch). */
function JamWib({ serverNow }: { serverNow: string }) {
  const [sekarang, setSekarang] = useState<Date | null>(null);
  useEffect(() => {
    const selisih = Date.parse(serverNow) - Date.now();
    const perbarui = () => setSekarang(new Date(Date.now() + selisih));
    perbarui();
    const t = setInterval(perbarui, 1000);
    return () => clearInterval(t);
  }, [serverNow]);
  return (
    <span className="text-base text-ink-muted tabular-nums" aria-live="off">
      {sekarang ? `${jamMenit(sekarang, true)} WIB` : " "}
    </span>
  );
}

function KartuSemangat({ streak, hariIni }: { streak: StreakInfo; hariIni: string }) {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-ink">Semangat Admin</h2>
      <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="text-4xl font-bold tracking-tight text-ink tabular-nums">{streak.current}</span>
        <span className="pb-1 text-base text-ink-muted">hari berturut-turut</span>
      </div>
      <div className="mt-2 min-h-6">
        <BarisApi jumlah={streak.current} />
      </div>
      <p className="mt-2 text-base text-ink-muted">
        {streak.current === 0
          ? "Masuk hari ini untuk memulai streak baru."
          : streak.sudahMasukHariIni
            ? "Hebat, hari ini sudah tercatat."
            : "Masuk hari ini supaya streak tidak putus."}
      </p>
      <p className="mt-3 flex items-center gap-2 text-base text-ink">
        <Trophy className="size-5 text-warning-fg" aria-hidden="true" />
        Rekor terpanjang: <strong className="font-semibold tabular-nums">{streak.longest} hari</strong>
      </p>
      <div className="mt-4">
        <TujuhHari streak={streak} hariIni={hariIni} />
      </div>
    </Card>
  );
}

function KartuTim({ data, superAdmin }: { data: AktivitasAdmin; superAdmin: boolean }) {
  const jumlahAktif = data.tim.filter((a) => a.online).length;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Users className="size-5 text-ink-muted" aria-hidden="true" />
          Tim Admin
        </h2>
        <JamWib serverNow={data.serverNow} />
      </div>
      <p className="px-5 pt-3 text-base text-ink-muted">{jumlahAktif} orang sedang aktif</p>
      <ul className="divide-y divide-line">
        {data.tim.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-5 py-3">
            <Avatar nama={a.nama} userId={a.id} fotoVersi={a.fotoVersi} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-ink">{a.nama}</p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
                <span>{a.role === "super_admin" ? "Super Admin" : "Admin"}</span>
                {superAdmin && a.streak && (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Flame className="size-4 text-accent-warm" aria-hidden="true" />
                    {a.streak.current} hari (rekor {a.streak.longest})
                  </span>
                )}
              </p>
            </div>
            {a.online ? (
              <Badge tone="success" className="text-sm">
                <span className="size-2 rounded-full bg-success-fg" aria-hidden="true" />
                Sedang aktif
              </Badge>
            ) : (
              <span className="max-w-[45%] text-right text-sm text-ink-muted">{teksStatus(a, data.hariIni)}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Kartu "Semangat Admin" + "Tim Admin" di dashboard admin. Data awal dari server; diperbarui
 * tiap PRESENCE.POLL_MS saat tab terlihat. 401/403 menghentikan polling.
 */
export function AktivitasAdminPanel({ awal, superAdmin }: { awal: AktivitasAdmin; superAdmin: boolean }) {
  const [data, setData] = useState(awal);

  useEffect(() => {
    let berhenti = false;
    async function muat() {
      if (berhenti || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/admin/presence", { cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          berhenti = true;
          return;
        }
        if (res.ok) setData((await res.json()) as AktivitasAdmin);
      } catch {
        // Coba lagi di jadwal berikutnya.
      }
    }
    const t = setInterval(() => void muat(), PRESENCE.POLL_MS);
    const saatTerlihat = () => {
      if (document.visibilityState === "visible") void muat();
    };
    document.addEventListener("visibilitychange", saatTerlihat);
    return () => {
      berhenti = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", saatTerlihat);
    };
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <KartuSemangat streak={data.saya} hariIni={data.hariIni} />
      <KartuTim data={data} superAdmin={superAdmin} />
    </div>
  );
}
