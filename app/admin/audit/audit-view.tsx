"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type PenggunaRingkas,
  type TransaksiDetail,
  type TipeTransaksi,
  formatRupiah,
  TIPE_TRANSAKSI,
} from "@/contract";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileCheck,
  Filter,
  ImageIcon,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";
import { BadgeTipe, IkonTipe, JumlahTransaksi } from "@/components/transaksi-tampilan";

export interface FilterAudit {
  adminId: string;
  tipe: TipeTransaksi | "";
  dari: string;
  sampai: string;
}

/**
 * Data audit datang dari Server Component (page.tsx). Filter & halaman disimpan di URL:
 * `jejak` = cursor halaman-halaman sebelumnya ("-" = halaman pertama), untuk tombol Sebelumnya.
 */
export function AuditView({
  stafList,
  auditItems,
  nextCursor,
  filter,
  cursor,
  jejak,
  errorMessage,
}: {
  stafList: PenggunaRingkas[];
  auditItems: TransaksiDetail[];
  nextCursor: string | null;
  filter: FilterAudit;
  cursor: string | undefined;
  jejak: string[];
  errorMessage: string | null;
}) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();

  // Isian filter (baru berlaku setelah "Terapkan Filter").
  const [filterAdminId, setFilterAdminId] = useState(filter.adminId);
  const [filterTipe, setFilterTipe] = useState<TipeTransaksi | "">(filter.tipe);
  const [filterDari, setFilterDari] = useState(filter.dari);
  const [filterSampai, setFilterSampai] = useState(filter.sampai);
  const cursorStack = jejak;

  function buka(f: FilterAudit, c: string | undefined, j: string[]) {
    const q = new URLSearchParams();
    if (f.adminId) q.set("admin", f.adminId);
    if (f.tipe) q.set("tipe", f.tipe);
    if (f.dari) q.set("dari", f.dari);
    if (f.sampai) q.set("sampai", f.sampai);
    if (c) q.set("cursor", c);
    if (j.length > 0) q.set("jejak", j.join(","));
    const qs = q.toString();
    startTransition(() => router.push(qs ? `/admin/audit?${qs}` : "/admin/audit"));
  }

  function handleNextPage() {
    if (!nextCursor) return;
    buka(filter, nextCursor, [...jejak, cursor ?? "-"]);
  }

  function handlePrevPage() {
    const stack = [...jejak];
    const sebelumnya = stack.pop();
    buka(filter, sebelumnya && sebelumnya !== "-" ? sebelumnya : undefined, stack);
  }

  // State tampilan saja: baris yang dibuka & foto yang sedang diperbesar.
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set());
  const [fotoBesar, setFotoBesar] = useState<{ url: string; alt: string } | null>(null);
  const alihkan = (id: string) =>
    setTerbuka((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });
  useEffect(() => {
    if (!fotoBesar) return;
    const tutup = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFotoBesar(null);
    };
    window.addEventListener("keydown", tutup);
    return () => window.removeEventListener("keydown", tutup);
  }, [fotoBesar]);

  return (
    <div className="space-y-6">
      <PageHeader description="Periksa transaksi bersama foto timbangan dan rincian barangnya." />

      {/* Filter */}
      <Card className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Petugas" htmlFor="audit-petugas">
            <Select id="audit-petugas" value={filterAdminId} onChange={(e) => setFilterAdminId(e.target.value)}>
              <option value="">Semua petugas</option>
              {stafList.map((staf) => (
                <option key={staf.id} value={staf.id}>
                  {staf.nama} ({staf.role})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tipe transaksi" htmlFor="audit-tipe">
            <Select
              id="audit-tipe"
              value={filterTipe}
              onChange={(e) => setFilterTipe(e.target.value as TipeTransaksi | "")}
            >
              <option value="">Semua tipe</option>
              {TIPE_TRANSAKSI.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Dari tanggal" htmlFor="audit-dari">
            <Input id="audit-dari" type="date" value={filterDari} onChange={(e) => setFilterDari(e.target.value)} />
          </Field>

          <Field label="Sampai tanggal" htmlFor="audit-sampai">
            <Input id="audit-sampai" type="date" value={filterSampai} onChange={(e) => setFilterSampai(e.target.value)} />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            onClick={() =>
              buka({ adminId: filterAdminId, tipe: filterTipe, dari: filterDari, sampai: filterSampai }, undefined, [])
            }
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : <Filter />}
            Terapkan filter
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setFilterAdminId("");
              setFilterTipe("");
              setFilterDari("");
              setFilterSampai("");
              buka({ adminId: "", tipe: "", dari: "", sampai: "" }, undefined, []);
            }}
          >
            <RotateCcw />
            Reset
          </Button>
        </div>
      </Card>

      {errorMessage && <Alert tone="danger">{errorMessage}</Alert>}

      {/* Daftar transaksi: baris ringkas, dikelompokkan per tanggal (WIB) */}
      <Card className="overflow-hidden">
        {loading ? (
          <EmptyState icon={<Loader2 className="animate-spin" />} title="Memuat data audit…" />
        ) : auditItems.length === 0 ? (
          <EmptyState
            icon={<FileCheck />}
            title="Tidak ada transaksi yang cocok"
            description="Coba ubah filter untuk melihat data yang berbeda."
          />
        ) : (
          kelompokPerTanggal(auditItems).map(({ kunci, label, items }) => (
            <section key={kunci} aria-label={label}>
              <h3 className="border-b border-line bg-surface-muted px-5 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase first:border-t-0">
                {label}
              </h3>
              <ul className="divide-y divide-line">
                {items.map((tx) => {
                  const terbukaIni = terbuka.has(tx.id);
                  return (
                    <li key={tx.id} className={terbukaIni ? "bg-surface-muted/60" : undefined}>
                      <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-5">
                        <button
                          type="button"
                          onClick={() => alihkan(tx.id)}
                          aria-expanded={terbukaIni}
                          aria-controls={`audit-rinci-${tx.id}`}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-control text-left sm:gap-3"
                        >
                          <span className="hidden sm:block">
                            <IkonTipe tipe={tx.tipe} />
                          </span>
                          <span className="min-w-0 flex-1 md:flex md:items-center md:gap-6">
                            <span className="block min-w-0 md:w-64 md:shrink-0">
                              <span className="block truncate font-medium text-ink">{tx.customerNama}</span>
                              <span className="block truncate text-sm text-ink-muted">
                                <span className="tabular-nums">{jamWib(tx.waktu)}</span> · oleh {tx.dibuatOlehNama}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-sm text-ink-muted md:mt-0 md:flex-1">
                              {ringkasanBarang(tx)}
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            <JumlahTransaksi jumlah={tx.jumlah} className="text-base" />
                            <span className="flex gap-1">
                              <BadgeTipe tipe={tx.tipe} />
                              {tx.sudahDibalik && <Badge tone="danger">Dibalik</Badge>}
                            </span>
                          </span>
                          <ChevronDown
                            className={`size-4 shrink-0 text-ink-subtle transition-transform duration-200 ${terbukaIni ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </button>

                        {tx.fotoUrl ? (
                          <button
                            type="button"
                            onClick={() => setFotoBesar({ url: tx.fotoUrl!, alt: `Foto timbangan transaksi ${tx.id}` })}
                            className="size-10 shrink-0 overflow-hidden rounded-control border border-line bg-surface-muted sm:size-12"
                            aria-label={`Perbesar foto timbangan transaksi ${tx.id}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- URL foto bertanda tangan berumur 5 menit; next/image tidak cocok. */}
                            <img src={tx.fotoUrl} alt="" className="size-full object-cover" />
                          </button>
                        ) : (
                          <span className="hidden size-12 shrink-0 items-center justify-center rounded-control border border-dashed border-line text-ink-subtle sm:flex" title="Tidak ada foto">
                            <ImageIcon className="size-4" aria-hidden="true" />
                            <span className="sr-only">Tidak ada foto</span>
                          </span>
                        )}
                      </div>

                      {terbukaIni && (
                        <div id={`audit-rinci-${tx.id}`} className="space-y-3 px-4 pb-4 sm:pl-[4.25rem] sm:pr-5">
                          {tx.items.length > 0 && (
                            <table className="w-full text-sm">
                              <caption className="sr-only">Rincian barang transaksi {tx.id}</caption>
                              <thead>
                                <tr className="text-left text-xs text-ink-muted">
                                  <th className="py-1.5 font-medium">Barang</th>
                                  <th className="py-1.5 text-right font-medium">Berat × harga</th>
                                  <th className="py-1.5 text-right font-medium">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tx.items.map((item, idx) => (
                                  <tr key={idx} className="border-t border-line">
                                    <td className="py-2 text-ink">{item.namaSampah}</td>
                                    <td className="py-2 text-right whitespace-nowrap text-ink-muted tabular-nums">
                                      {item.berat} kg × {formatRupiah(item.hargaSnapshot)}
                                    </td>
                                    <td className="py-2 text-right font-medium whitespace-nowrap text-ink tabular-nums">
                                      {formatRupiah(item.subtotal)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {tx.catatan && (
                            <p className="text-sm text-ink-muted">
                              <span className="font-medium text-ink">Catatan:</span> {tx.catatan}
                            </p>
                          )}
                          <Link href={`/admin/transaksi/${tx.id}`} className={buttonClass("secondary")}>
                            <ExternalLink />
                            Detail transaksi
                          </Link>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}

        {(cursorStack.length > 0 || nextCursor) && !loading && (
          <nav aria-label="Halaman audit" className="flex items-center justify-between border-t border-line px-4 py-3 sm:px-5">
            <Button variant="secondary" onClick={handlePrevPage} disabled={cursorStack.length === 0}>
              <ChevronLeft />
              Sebelumnya
            </Button>
            <span className="text-sm text-ink-muted tabular-nums">Halaman {cursorStack.length + 1}</span>
            <Button variant="secondary" onClick={handleNextPage} disabled={!nextCursor}>
              Berikutnya
              <ChevronRight />
            </Button>
          </nav>
        )}
      </Card>

      {/* Foto timbangan ukuran besar */}
      {fotoBesar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={fotoBesar.alt}
          onClick={() => setFotoBesar(null)}
        >
          <div className="relative max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL foto bertanda tangan berumur 5 menit; next/image tidak cocok. */}
            <img src={fotoBesar.url} alt={fotoBesar.alt} className="max-h-[85dvh] w-auto rounded-card bg-surface object-contain" />
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setFotoBesar(null)}
              className="absolute top-3 right-3"
              aria-label="Tutup foto"
              autoFocus
            >
              <X />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Kelompok tampilan per tanggal kalender WIB, urutan dari data (terbaru dulu). */
function kelompokPerTanggal(items: TransaksiDetail[]) {
  const grup: { kunci: string; label: string; items: TransaksiDetail[] }[] = [];
  for (const tx of items) {
    const kunci = new Date(tx.waktu).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    let g = grup.find((x) => x.kunci === kunci);
    if (!g) {
      const label = new Date(tx.waktu).toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      g = { kunci, label, items: [] };
      grup.push(g);
    }
    g.items.push(tx);
  }
  return grup;
}

const jamWib = (iso: string) =>
  `${new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })} WIB`;

/** Ringkasan barang satu baris: "Kardus 10.00 kg, Kaleng 1.50 kg" atau catatan untuk non-setor. */
function ringkasanBarang(tx: TransaksiDetail) {
  if (tx.items.length === 0) return tx.catatan ?? "—";
  const [pertama, ...sisa] = tx.items;
  return `${pertama.namaSampah} ${pertama.berat} kg${sisa.length > 0 ? `, +${sisa.length} barang lain` : ""}`;
}
