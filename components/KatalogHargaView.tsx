"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { actions } from "@/lib/api/actions";
import {
  type JenisSampah,
  formatRupiah,
  ERROR_MESSAGES,
  type SesiInfo,
} from "@/contract";
import {
  Trash2,
  Plus,
  Edit2,
  Loader2,
  History,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Search,
  Eye,
  X,
  ArrowUpDown,
  Filter,
  RotateCcw,
  Coins,
  Store,
  TrendingUp,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert, EmptyState, ModalShell } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";

// Category definitions with keyword heuristics for automatic categorization
export const WASTE_CATEGORIES = [
  { id: "all", label: "Semua Kategori" },
  { id: "plastik", label: "Plastik", keywords: ["plastik", "pet", "hdpe", "pp", "ldpe", "pvc", "botol", "kresek", "gelas", "cup", "sedotan", "tutup"] },
  { id: "kertas", label: "Kertas & Kardus", keywords: ["kertas", "kardus", "karton", "duplek", "koran", "hvs", "buku", "majalah", "paper", "buram", "semen"] },
  { id: "logam", label: "Besi & Logam", keywords: ["logam", "besi", "tembaga", "aluminium", "seng", "kaleng", "kuningan", "kawat", "baja", "metal", "greng", "plat"] },
  { id: "kaca", label: "Kaca & Beling", keywords: ["kaca", "beling", "botol kaca", "toples", "glass", "marjan", "bir", "kecap"] },
  { id: "elektronik", label: "Elektronik & Aki", keywords: ["elektronik", "aki", "baterai", "kabel", "pcb", "dinamo", "electronic", "hp", "laptop", "trafo"] },
  { id: "lainnya", label: "Lainnya / Minyak", keywords: ["minyak", "jelantah", "organik", "karung", "kayu", "karet", "ban"] },
] as const;

export type CategoryId = (typeof WASTE_CATEGORIES)[number]["id"];

export const SORT_OPTIONS = [
  { id: "terbaru", label: "Terbaru" },
  { id: "harga-tertinggi", label: "Harga Tertinggi" },
  { id: "harga-terendah", label: "Harga Terendah" },
  { id: "nama-asc", label: "Nama (A - Z)" },
  { id: "nama-desc", label: "Nama (Z - A)" },
] as const;

export type SortOptionId = (typeof SORT_OPTIONS)[number]["id"];

function detectItemCategory(name: string): CategoryId {
  const lower = name.toLowerCase();
  for (const cat of WASTE_CATEGORIES) {
    if (cat.id === "all" || cat.id === "lainnya") continue;
    if ("keywords" in cat && cat.keywords.some((k) => lower.includes(k))) {
      return cat.id;
    }
  }
  return "lainnya";
}

function getCategoryLabel(id: string): string {
  const cat = WASTE_CATEGORIES.find((c) => c.id === id);
  return cat ? cat.label : id;
}

interface Props {
  sesi: SesiInfo;
  /** Dari listJenisSampah di Server Component (page.tsx); diperbarui lewat router.refresh(). */
  list: JenisSampah[];
}

export function KatalogHargaView({ sesi, list }: Props) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();

  // Tab Switcher for Admin (Harga Beli vs Harga Jual Lapak)
  const [activePriceTab, setActivePriceTab] = useState<"beli" | "jual">("beli");

  // Filter & Search & Sort States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOptionId>("terbaru");
  const [statusFilter, setStatusFilter] = useState<"all" | "aktif" | "nonaktif">("aktif");

  // Form / Modal State for Admin/SuperAdmin
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<JenisSampah | null>(null);
  const [nama, setNama] = useState("");
  const [hargaBeli, setHargaBeli] = useState("");
  const [hargaJual, setHargaJual] = useState("");
  const [aktif, setAktif] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Determine user role
  const userRole = sesi?.role;
  const isSuperAdmin = userRole === "super_admin";
  const isAdmin = userRole === "admin" || isSuperAdmin;
  const isNasabah = userRole === "nasabah";
  const isReadOnly = !isAdmin; // Nasabah and Guests are strictly Read-Only

  // Cleanly manage body scroll locking when modal is open/closed
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  function handleOpenAdd() {
    if (isReadOnly) return;
    setEditingItem(null);
    setNama("");
    setHargaBeli("");
    setHargaJual("");
    setAktif(true);
    setErrorMessage(null);
    setModalOpen(true);
  }

  function handleOpenEdit(item: JenisSampah) {
    if (isReadOnly) return;
    setEditingItem(item);
    setNama(item.nama);
    setHargaBeli(item.hargaBeli.toString());
    setHargaJual(item.hargaJual ? item.hargaJual.toString() : "");
    setAktif(item.aktif);
    setErrorMessage(null);
    setModalOpen(true);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setEditingItem(null);
    setErrorMessage(null);
  }

  function handleResetAllFilters() {
    setSearchQuery("");
    setSelectedCategory("all");
    setSortBy("terbaru");
    setStatusFilter(isAdmin ? "all" : "aktif");
  }

  const isFilterActive =
    searchQuery.trim().length > 0 ||
    selectedCategory !== "all" ||
    sortBy !== "terbaru" ||
    (isAdmin && statusFilter !== "all");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnly) {
      setErrorMessage("Akses ditolak. Anda tidak memiliki izin untuk mengubah harga.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const beli = parseInt(hargaBeli, 10);
    if (isNaN(beli) || beli <= 0) {
      setErrorMessage("Harga beli per kg harus berupa angka positif (contoh: 3000).");
      return;
    }

    let jual: number | undefined = undefined;
    if (hargaJual.trim()) {
      jual = parseInt(hargaJual, 10);
      if (isNaN(jual) || jual <= 0) {
        setErrorMessage("Harga jual ke lapak harus berupa angka positif.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        id: editingItem ? editingItem.id : undefined,
        nama: nama.trim(),
        hargaBeli: beli,
        hargaJual: jual,
        aktif,
      };

      // Call server action
      const res = await actions.updateHargaSampah(payload);

      if (!res.ok) {
        setErrorMessage(res.message || ERROR_MESSAGES[res.code] || "Gagal menyimpan harga.");
      } else {
        setSuccessMessage(
          editingItem
            ? `Harga "${res.data.nama}" berhasil diperbarui.`
            : `Jenis sampah "${res.data.nama}" berhasil ditambahkan.`
        );
        handleCloseModal();
        startTransition(() => router.refresh());
      }
    } catch {
      setErrorMessage(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  // Filtered & Sorted List
  const filteredList = useMemo(() => {
    let result = list.filter((item) => {
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = item.nama.toLowerCase().includes(query);
        if (!matchName) return false;
      }

      // Category filter
      if (selectedCategory !== "all") {
        const itemCat = detectItemCategory(item.nama);
        if (itemCat !== selectedCategory) {
          return false;
        }
      }

      // Status filter (admin only; read-only users only see active)
      if (!isAdmin) {
        return item.aktif;
      }

      if (statusFilter === "aktif") return item.aktif;
      if (statusFilter === "nonaktif") return !item.aktif;
      return true;
    });

    // Sorting
    result = [...result].sort((a, b) => {
      const getComparePrice = (item: JenisSampah) => {
        if (isAdmin && activePriceTab === "jual") {
          return item.hargaJual ?? 0;
        }
        return item.hargaBeli;
      };

      switch (sortBy) {
        case "harga-tertinggi":
          return getComparePrice(b) - getComparePrice(a);
        case "harga-terendah":
          return getComparePrice(a) - getComparePrice(b);
        case "nama-asc":
          return a.nama.localeCompare(b.nama, "id-ID");
        case "nama-desc":
          return b.nama.localeCompare(a.nama, "id-ID");
        case "terbaru":
        default: {
          // If available, sort by time of last update descending, then by id desc
          const timeA = a.terakhirDiubah ? new Date(a.terakhirDiubah.waktu).getTime() : 0;
          const timeB = b.terakhirDiubah ? new Date(b.terakhirDiubah.waktu).getTime() : 0;
          if (timeA !== timeB) return timeB - timeA;
          return Number(b.id) - Number(a.id);
        }
      }
    });

    return result;
  }, [list, searchQuery, selectedCategory, sortBy, statusFilter, isAdmin, activePriceTab]);

  return (
    <div className="space-y-6">
      {/* Kepala: peran + deskripsi + aksi */}
      <PageHeader
        eyebrow={
          isSuperAdmin ? (
            <Badge tone="warning">
              <ShieldCheck aria-hidden="true" />
              Super Admin
            </Badge>
          ) : isAdmin ? (
            <Badge tone="brand">
              <UserCheck aria-hidden="true" />
              Admin
            </Badge>
          ) : isNasabah ? (
            <Badge tone="info">
              <Eye aria-hidden="true" />
              Nasabah (hanya lihat)
            </Badge>
          ) : (
            <Badge tone="neutral">
              <Eye aria-hidden="true" />
              Katalog publik (hanya lihat)
            </Badge>
          )
        }
        description={
          <span className="hidden sm:inline">
            {isAdmin
              ? "Kelola tarif harga beli nasabah dan harga jual ke lapak/pengepul untuk menjaga margin kas operasional."
              : "Daftar tarif harga beli resmi per kilogram untuk setiap kategori sampah daur ulang secara transparan dan terkini."}
          </span>
        }
        actions={
          <>
            {isSuperAdmin && (
              <Link href="/admin/audit-harga" className={buttonClass("secondary")}>
                <History aria-hidden="true" />
                <span>
                  Audit<span className="hidden sm:inline"> log harga</span>
                </span>
                <ArrowRight aria-hidden="true" />
              </Link>
            )}

            {/* ONLY ADMIN & SUPER ADMIN CAN ADD WASTE / EDIT */}
            {isAdmin && (
              <Button onClick={handleOpenAdd}>
                <Plus />
                <span>
                  Tambah<span className="hidden sm:inline"> sampah</span>
                </span>
              </Button>
            )}
          </>
        }
      />

      {/* Global Alerts */}
      {errorMessage && (
        <Alert
          tone="danger"
          action={
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-sm font-medium underline underline-offset-2"
            >
              Tutup
            </button>
          }
        >
          {errorMessage}
        </Alert>
      )}

      {successMessage && (
        <Alert
          tone="success"
          action={
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-sm font-medium underline underline-offset-2"
            >
              Tutup
            </button>
          }
        >
          {successMessage}
        </Alert>
      )}

      {/* ADMIN ONLY TAB SWITCHER: HARGA BELI NASABAH vs HARGA JUAL LAPAK */}
      {isAdmin && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" aria-label="Jenis harga" className="inline-flex rounded-control bg-surface p-1 ring-1 ring-line ring-inset">
            <button
              type="button"
              role="tab"
              aria-selected={activePriceTab === "beli"}
              onClick={() => setActivePriceTab("beli")}
              className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-[6px] px-3 text-sm font-medium transition-colors duration-150 sm:flex-none ${
                activePriceTab === "beli" ? "bg-brand text-on-brand" : "text-ink-muted hover:bg-surface-muted hover:text-ink"
              }`}
            >
              <Coins className="size-4" aria-hidden="true" />
              <span className="whitespace-nowrap">
                Harga beli<span className="hidden sm:inline"> (nasabah)</span>
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activePriceTab === "jual"}
              onClick={() => setActivePriceTab("jual")}
              className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-[6px] px-3 text-sm font-medium transition-colors duration-150 sm:flex-none ${
                activePriceTab === "jual" ? "bg-brand text-on-brand" : "text-ink-muted hover:bg-surface-muted hover:text-ink"
              }`}
            >
              <Store className="size-4" aria-hidden="true" />
              <span className="whitespace-nowrap">
                Harga jual<span className="hidden sm:inline"> (lapak)</span>
              </span>
            </button>
          </div>

          <p className="hidden items-center gap-1.5 text-sm text-ink-muted sm:flex">
            {activePriceTab === "beli" ? (
              <>
                <Info className="size-4 shrink-0" aria-hidden="true" />
                <span>Tarif resmi yang dibayarkan ke nasabah saat setor sampah.</span>
              </>
            ) : (
              <>
                <TrendingUp className="size-4 shrink-0" aria-hidden="true" />
                <span>Tarif penjualan ke lapak & estimasi margin per kg (khusus admin).</span>
              </>
            )}
          </p>
        </div>
      )}

      {/* FILTERS & SEARCH & SORT TOOLBAR */}
      <Card>
        <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
          {/* Search Box */}
          <div className="relative min-w-0 flex-1">
            <label htmlFor="katalog-cari" className="sr-only">
              Cari jenis sampah
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <Input
              id="katalog-cari"
              type="text"
              placeholder="Cari jenis sampah…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-11 pl-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-control text-ink-muted hover:text-ink"
                title="Hapus pencarian"
                aria-label="Hapus pencarian"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:flex lg:items-center">
            {/* Dropdown Kategori */}
            <div className="lg:w-48">
              <label htmlFor="katalog-kategori" className="sr-only">
                Kategori
              </label>
              <Select
                id="katalog-kategori"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {WASTE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Dropdown Sort */}
            <div className="lg:w-48">
              <label htmlFor="katalog-urut" className="sr-only">
                Urutkan
              </label>
              <Select
                id="katalog-urut"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOptionId)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Status Filter for Admin Only */}
            {isAdmin && (
              <div role="group" aria-label="Filter status" className="inline-flex rounded-control bg-surface-muted p-1 ring-1 ring-line ring-inset col-span-2 lg:col-span-1">
                <button
                  type="button"
                  aria-pressed={statusFilter === "aktif"}
                  onClick={() => setStatusFilter("aktif")}
                  className={`h-9 flex-1 rounded-[6px] px-3 text-sm font-medium transition-colors duration-150 ${
                    statusFilter === "aktif" ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Aktif
                </button>
                <button
                  type="button"
                  aria-pressed={statusFilter === "nonaktif"}
                  onClick={() => setStatusFilter("nonaktif")}
                  className={`h-9 flex-1 rounded-[6px] px-3 text-sm font-medium transition-colors duration-150 ${
                    statusFilter === "nonaktif" ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Nonaktif
                </button>
                <button
                  type="button"
                  aria-pressed={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                  className={`h-9 flex-1 rounded-[6px] px-3 text-sm font-medium transition-colors duration-150 ${
                    statusFilter === "all" ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Semua
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active Filters Badges & Dynamic Count Info */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-sm sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {selectedCategory !== "all" && (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-soft pr-1 pl-3 text-xs font-medium text-brand-hover">
                <Filter className="size-3.5" aria-hidden="true" />
                <span>{getCategoryLabel(selectedCategory)}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className="flex size-6 items-center justify-center rounded-full hover:bg-brand/10"
                  title="Hapus filter kategori"
                  aria-label="Hapus filter kategori"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            )}

            {sortBy !== "terbaru" && (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-soft pr-1 pl-3 text-xs font-medium text-brand-hover">
                <ArrowUpDown className="size-3.5" aria-hidden="true" />
                <span>{SORT_OPTIONS.find((s) => s.id === sortBy)?.label}</span>
                <button
                  type="button"
                  onClick={() => setSortBy("terbaru")}
                  className="flex size-6 items-center justify-center rounded-full hover:bg-brand/10"
                  title="Reset urutan ke Terbaru"
                  aria-label="Reset urutan ke Terbaru"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            )}

            {searchQuery.trim() && (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-muted pr-1 pl-3 text-xs font-medium text-ink ring-1 ring-line ring-inset">
                <Search className="size-3.5 text-ink-muted" aria-hidden="true" />
                <span>&quot;{searchQuery}&quot;</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="flex size-6 items-center justify-center rounded-full hover:bg-line"
                  title="Hapus kata kunci"
                  aria-label="Hapus kata kunci"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            )}

            {isAdmin && statusFilter !== "all" && (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-muted pr-1 pl-3 text-xs font-medium text-ink capitalize ring-1 ring-line ring-inset">
                <span>Status: {statusFilter}</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className="flex size-6 items-center justify-center rounded-full hover:bg-line"
                  title="Hapus filter status"
                  aria-label="Hapus filter status"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            )}

            {isFilterActive ? (
              <Button variant="ghost" onClick={handleResetAllFilters} className="h-8 px-2.5 text-xs">
                <RotateCcw />
                <span>Reset semua</span>
              </Button>
            ) : (
              <span className="text-xs text-ink-muted">Tanpa filter khusus</span>
            )}
          </div>

          <p className="ml-auto shrink-0 text-ink-muted">
            Menampilkan <strong className="font-semibold text-ink tabular-nums">{filteredList.length}</strong> dari{" "}
            <span className="tabular-nums">{list.length}</span> jenis sampah
          </p>
        </div>
      </Card>

      {/* Daftar harga */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            <span>Memuat katalog harga sampah…</span>
          </div>
        ) : filteredList.length === 0 ? (
          <EmptyState
            icon={<Trash2 />}
            title="Jenis sampah tidak ditemukan"
            description="Tidak ada data sampah yang cocok dengan pencarian atau filter yang dipilih."
            action={
              isFilterActive && (
                <Button variant="secondary" onClick={handleResetAllFilters}>
                  <RotateCcw />
                  <span>Reset semua filter</span>
                </Button>
              )
            }
          />
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Daftar harga jenis sampah</caption>
            <thead className="bg-surface-muted">
              <tr className="text-left text-xs text-ink-muted">
                <th scope="col" className="h-10 pr-2 pl-4 font-medium sm:pl-5">
                  Jenis sampah
                </th>
                <th scope="col" className="h-10 px-2 text-right font-medium whitespace-nowrap">
                  {isAdmin && activePriceTab === "jual" ? "Harga jual/kg" : "Harga beli/kg"}
                </th>
                {isAdmin && (
                  <th scope="col" className="h-10 w-12 pr-2 sm:pr-3">
                    <span className="sr-only">Aksi</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
            {filteredList.map((item) => {
              const detectedCat = detectItemCategory(item.nama);
              const categoryLabel = getCategoryLabel(detectedCat);

              // Calculate selling price and margin for admin
              const effectiveHargaJual = item.hargaJual ?? null;
              const marginRupiah = effectiveHargaJual === null ? null : effectiveHargaJual - item.hargaBeli;
              const marginPersen = marginRupiah !== null && item.hargaBeli > 0 ? ((marginRupiah / item.hargaBeli) * 100).toFixed(0) : null;
              const tanda = (n: number) => (n >= 0 ? "+" : "");

              return (
                <tr key={item.id} className="border-t border-line transition-colors duration-150 hover:bg-brand-soft">
                  {/* Nama + kategori (+ status & riwayat) */}
                  <td className="py-2.5 pr-2 pl-4 align-middle sm:pl-5">
                    <p className="leading-snug font-medium text-ink">{item.nama}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
                      <span>{categoryLabel}</span>
                      {isAdmin && !item.aktif && <Badge tone="danger" className="px-1.5 py-0">Nonaktif</Badge>}
                      <span className="hidden items-center gap-1 sm:inline-flex">
                        <Clock className="size-3 shrink-0" aria-hidden="true" />
                        {item.terakhirDiubah ? (
                          <span>
                            Diubah{" "}
                            <span className="tabular-nums">
                              {new Date(item.terakhirDiubah.waktu).toLocaleString("id-ID", {
                                timeZone: "Asia/Jakarta",
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}{" "}
                              WIB
                            </span>{" "}
                            · oleh {item.terakhirDiubah.diubahOlehNama}
                          </span>
                        ) : (
                          <span>Harga belum pernah diubah</span>
                        )}
                      </span>
                    </p>
                  </td>

                  {/* Harga (+ margin di tab jual) */}
                  <td className="px-2 py-2.5 text-right align-middle whitespace-nowrap tabular-nums">
                    {isAdmin && activePriceTab === "jual" ? (
                      <>
                        {effectiveHargaJual === null ? (
                          <span className="text-xs text-ink-muted">Belum diatur</span>
                        ) : (
                          <span className="font-semibold text-ink">{formatRupiah(effectiveHargaJual)}</span>
                        )}
                        {effectiveHargaJual !== null && (
                          <span className="block text-xs text-ink-muted">
                            margin {marginRupiah === null ? "-" : `${tanda(marginRupiah)}${formatRupiah(marginRupiah)}/kg`}{" "}
                            ({marginPersen === null ? "-" : `${tanda(marginRupiah ?? 0)}${marginPersen}%`})
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="font-semibold text-ink">{formatRupiah(item.hargaBeli)}</span>
                    )}
                  </td>

                  {/* Aksi: hanya admin & super admin */}
                  {isAdmin && (
                    <td className="py-1 pr-2 text-right align-middle sm:pr-3">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        aria-label={`Edit harga ${item.nama}`}
                        title="Edit harga"
                        className={buttonClass("ghost", "icon")}
                      >
                        <Edit2 />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            </tbody>
          </table>
        )}
      </Card>

      {/* MODAL DIALOG FOR EDIT / ADD (ADMIN & SUPER ADMIN ONLY) */}
      {modalOpen && isAdmin && (
        <ModalShell labelledBy="katalog-modal-judul" className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <h2 id="katalog-modal-judul" className="text-base font-semibold text-ink">
                {editingItem ? "Edit harga sampah" : "Tambah jenis sampah baru"}
              </h2>
              <p className="text-sm text-ink-muted">
                {editingItem
                  ? "Perbarui harga beli nasabah & harga jual ke lapak."
                  : "Daftarkan jenis sampah baru ke katalog."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCloseModal}
              aria-label="Tutup dialog"
              className={buttonClass("ghost", "icon", "-mt-2 -mr-2")}
            >
              <X />
            </button>
          </div>

          {errorMessage && <Alert tone="danger">{errorMessage}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nama jenis sampah" htmlFor="katalog-nama" required>
              <Input
                id="katalog-nama"
                type="text"
                required
                placeholder="contoh: Kardus / Karton Tebal"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
              />
            </Field>

            {/* Harga Beli ke Nasabah */}
            <Field
              label="Harga beli ke nasabah (Rp/kg)"
              htmlFor="katalog-harga-beli"
              required
              hint={
                hargaBeli && !isNaN(parseInt(hargaBeli, 10)) ? (
                  <span className="tabular-nums">
                    Pratinjau: <strong className="font-semibold text-ink">{formatRupiah(parseInt(hargaBeli, 10))}</strong> per kg
                  </span>
                ) : undefined
              }
            >
              <Input
                id="katalog-harga-beli"
                type="number"
                required
                min={1}
                placeholder="contoh: 3000"
                value={hargaBeli}
                onChange={(e) => setHargaBeli(e.target.value)}
                className="tabular-nums"
              />
            </Field>

            {/* Harga Jual ke Lapak / Pengepul */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="katalog-harga-jual" className="block text-sm font-medium text-ink">
                  Harga jual ke lapak / pengepul (Rp/kg)
                </label>
                <Badge tone="warning">Khusus admin</Badge>
              </div>
              <Input
                id="katalog-harga-jual"
                type="number"
                min={1}
                placeholder="contoh: 4000 (kosongkan bila belum ada)"
                value={hargaJual}
                onChange={(e) => setHargaJual(e.target.value)}
                className="tabular-nums"
              />
              {hargaBeli && hargaJual && !isNaN(parseInt(hargaBeli, 10)) && !isNaN(parseInt(hargaJual, 10)) && (
                <div className="flex items-center justify-between rounded-control bg-surface-muted px-3 py-2 text-xs tabular-nums ring-1 ring-line ring-inset">
                  <span className="text-ink-muted">
                    Estimasi margin:{" "}
                    <strong className={parseInt(hargaJual, 10) >= parseInt(hargaBeli, 10) ? "font-semibold text-success-fg" : "font-semibold text-danger-fg"}>
                      {parseInt(hargaJual, 10) >= parseInt(hargaBeli, 10) ? "+" : ""}
                      {formatRupiah(parseInt(hargaJual, 10) - parseInt(hargaBeli, 10))}/kg
                    </strong>
                  </span>
                  <span className="text-ink-muted">
                    ({(((parseInt(hargaJual, 10) - parseInt(hargaBeli, 10)) / parseInt(hargaBeli, 10)) * 100).toFixed(0)}%)
                  </span>
                </div>
              )}
            </div>

            <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-ink select-none">
              <input
                type="checkbox"
                checked={aktif}
                onChange={(e) => setAktif(e.target.checked)}
                className="size-4 shrink-0 accent-brand"
              />
              <span>Status aktif (tersedia untuk transaksi setor nasabah)</span>
            </label>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button variant="secondary" onClick={handleCloseModal}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>Menyimpan…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 />
                    <span>{editingItem ? "Simpan harga" : "Tambah sampah"}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
