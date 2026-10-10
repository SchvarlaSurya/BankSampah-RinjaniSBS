"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { queries } from "@/src/lib/api/queries";
import { actions } from "@/src/lib/api/actions";
import {
  JenisSampah,
  formatRupiah,
  ERROR_MESSAGES,
  SesiInfo,
} from "@/src/contract";
import {
  Trash2,
  Plus,
  Edit2,
  AlertCircle,
  Loader2,
  History,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Search,
  Tag,
  Eye,
  X,
  ArrowUpDown,
  Filter,
  RotateCcw,
  Layers,
  ChevronDown,
  Coins,
  Store,
  TrendingUp,
  Info,
} from "lucide-react";

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
  initialSesi?: SesiInfo | null;
  mode?: "admin" | "nasabah" | "public";
}

export function KatalogHargaView({ initialSesi, mode: _mode = "public" }: Props) {
  const [sesi, setSesi] = useState<SesiInfo | null>(initialSesi ?? null);
  const [list, setList] = useState<JenisSampah[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function loadData() {
    try {
      const [sesiData, res] = await Promise.all([
        queries.getSesi(),
        queries.listJenisSampah({ termasukNonaktif: isAdmin }),
      ]);

      if (sesiData) {
        setSesi(sesiData);
      }
      if (res.ok) {
        setList(res.data);
      }
    } catch (err) {
      console.error("Gagal memuat katalog sampah:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        const [sesiData, res] = await Promise.all([
          queries.getSesi(),
          queries.listJenisSampah({ termasukNonaktif: isAdmin }),
        ]);

        if (!ignore) {
          if (sesiData) setSesi(sesiData);
          if (res.ok) setList(res.data);
        }
      } catch (err) {
        console.error("Gagal memuat katalog sampah:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchData();
    return () => {
      ignore = true;
    };
  }, [isAdmin]);

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
    setHargaJual(item.hargaJual ? item.hargaJual.toString() : Math.round(item.hargaBeli * 1.2).toString());
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
        await loadData();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan perubahan.");
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
          return item.hargaJual ?? Math.round(item.hargaBeli * 1.2);
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {isSuperAdmin ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Super Admin
                </span>
              ) : isAdmin ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  <UserCheck className="w-3.5 h-3.5" />
                  Admin
                </span>
              ) : isNasabah ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                  <Eye className="w-3.5 h-3.5" />
                  Nasabah (Read-Only)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700/40 border border-slate-700 text-slate-300 text-xs font-semibold">
                  <Eye className="w-3.5 h-3.5" />
                  Katalog Publik (Read-Only)
                </span>
              )}

              <span className="text-xs text-slate-400">
                &bull; Update Terkini Bank Sampah Rinjani SBS
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <Tag className="w-6 h-6 text-emerald-400 shrink-0" />
              <span>Katalog Harga Sampah</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {isAdmin
                ? "Kelola tarif harga beli nasabah dan harga jual ke lapak/pengepul untuk menjaga margin kas operasional."
                : "Daftar tarif harga beli resmi per kilogram untuk setiap kategori sampah daur ulang secara transparan dan terkini."}
            </p>
          </div>

          {/* Action Header Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isSuperAdmin && (
              <Link
                href="/admin/audit-harga"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700 shadow-md"
              >
                <History className="w-4 h-4 text-amber-400" />
                <span>Audit Log Harga</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            )}

            {/* ONLY ADMIN & SUPER ADMIN CAN ADD WASTE / EDIT */}
            {isAdmin && (
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Sampah</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-md animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-xs underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-md animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ADMIN ONLY TAB SWITCHER: HARGA BELI NASABAH vs HARGA JUAL LAPAK */}
      {isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800/80">
            <button
              type="button"
              onClick={() => setActivePriceTab("beli")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activePriceTab === "beli"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Harga Beli (Nasabah)</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePriceTab("jual")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activePriceTab === "jual"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Harga Jual (Lapak/Pengepul)</span>
              <span className="px-1.5 py-0.5 rounded-md bg-amber-950/80 text-amber-300 text-[10px] font-mono border border-amber-800/50">
                Admin
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-400 px-2 flex items-center gap-2">
            {activePriceTab === "beli" ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Info className="w-4 h-4 shrink-0" />
                <span>Tarif resmi yang dibayarkan ke Nasabah saat setor sampah.</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>Tarif penjualan ke lapak & estimasi margin keuntungan per kg.</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* FILTERS & SEARCH & SORT TOOLBAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari jenis sampah (mis: Botol PET, Kardus)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 rounded-full"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters Container */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            {/* Dropdown Kategori */}
            <div className="relative w-full sm:w-48">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none">
                <Filter className="w-3.5 h-3.5" />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full appearance-none bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium rounded-2xl pl-9 pr-8 py-2.5 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              >
                {WASTE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-slate-950 text-slate-200">
                    {cat.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Dropdown Sort */}
            <div className="relative w-full sm:w-48">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none">
                <ArrowUpDown className="w-3.5 h-3.5" />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOptionId)}
                className="w-full appearance-none bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium rounded-2xl pl-9 pr-8 py-2.5 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-slate-950 text-slate-200">
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Status Filter for Admin Only */}
            {isAdmin && (
              <div className="inline-flex bg-slate-950 border border-slate-800 p-1 rounded-2xl text-xs shrink-0 w-full sm:w-auto justify-center">
                <button
                  type="button"
                  onClick={() => setStatusFilter("aktif")}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                    statusFilter === "aktif"
                      ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Aktif
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("nonaktif")}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                    statusFilter === "nonaktif"
                      ? "bg-rose-500/20 text-rose-300 font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Nonaktif
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                    statusFilter === "all"
                      ? "bg-slate-800 text-white font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Semua
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active Filters Badges & Dynamic Count Info */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-800/60 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-medium">Filter Aktif:</span>

            {selectedCategory !== "all" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                <Filter className="w-3 h-3" />
                <span>{getCategoryLabel(selectedCategory)}</span>
                <button
                  onClick={() => setSelectedCategory("all")}
                  className="hover:text-emerald-200 ml-0.5"
                  title="Hapus filter kategori"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {sortBy !== "terbaru" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                <ArrowUpDown className="w-3 h-3" />
                <span>{SORT_OPTIONS.find((s) => s.id === sortBy)?.label}</span>
                <button
                  onClick={() => setSortBy("terbaru")}
                  className="hover:text-emerald-200 ml-0.5"
                  title="Reset urutan ke Terbaru"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 font-medium">
                <Search className="w-3 h-3 text-slate-400" />
                <span>&quot;{searchQuery}&quot;</span>
                <button
                  onClick={() => setSearchQuery("")}
                  className="hover:text-white ml-0.5"
                  title="Hapus kata kunci"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {isAdmin && statusFilter !== "all" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-medium capitalize">
                <span>Status: {statusFilter}</span>
                <button
                  onClick={() => setStatusFilter("all")}
                  className="hover:text-white ml-0.5"
                  title="Hapus filter status"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {isFilterActive ? (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors text-xs font-semibold ml-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Semua</span>
              </button>
            ) : (
              <span className="text-slate-500 italic text-[11px]">
                Tidak ada filter khusus (Menampilkan default)
              </span>
            )}
          </div>

          <div className="text-slate-400 font-mono text-xs ml-auto shrink-0">
            Menampilkan <strong className="text-emerald-400 font-bold">{filteredList.length}</strong> dari {list.length} jenis sampah
          </div>
        </div>
      </div>

      {/* Catalog Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm flex flex-col justify-center items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <span>Memuat katalog harga sampah...</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-4 shadow-xl animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
            <Trash2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-200 text-base sm:text-lg">Jenis sampah tidak ditemukan</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Tidak ada data sampah yang cocok dengan kombinasi pencarian atau filter yang Anda pilih saat ini.
            </p>
          </div>
          {isFilterActive && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Semua Filter</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((item) => {
            const detectedCat = detectItemCategory(item.nama);
            const categoryLabel = getCategoryLabel(detectedCat);

            // Calculate selling price and margin for admin
            const effectiveHargaJual = item.hargaJual ?? Math.round(item.hargaBeli * 1.2);
            const marginRupiah = effectiveHargaJual - item.hargaBeli;
            const marginPersen = item.hargaBeli > 0 ? ((marginRupiah / item.hargaBeli) * 100).toFixed(0) : "0";

            return (
              <div
                key={item.id}
                className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-5 sm:p-6 flex flex-col justify-between gap-4 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-950/20 relative group"
              >
                {/* Card Top */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          <Layers className="w-3 h-3 text-emerald-400" />
                          {categoryLabel}
                        </span>

                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                            item.aktif
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {item.aktif ? "Tersedia / Aktif" : "Nonaktif"}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-100 text-base sm:text-lg group-hover:text-emerald-300 transition-colors truncate">
                        {item.nama}
                      </h3>
                    </div>

                    {/* Price Tag */}
                    <div className="text-right shrink-0">
                      {isAdmin && activePriceTab === "jual" ? (
                        <>
                          <span className="text-xs text-amber-400 font-semibold block mb-0.5">Harga Jual Lapak</span>
                          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight">
                            {formatRupiah(effectiveHargaJual)}
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">per kilogram</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-slate-400 block mb-0.5">Harga Beli</span>
                          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight">
                            {formatRupiah(item.hargaBeli)}
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">per kilogram</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ADMIN ONLY: Tab Harga Jual Margin Details */}
                  {isAdmin && activePriceTab === "jual" && (
                    <div className="p-3 rounded-2xl bg-slate-950/90 border border-amber-500/20 flex items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Harga Beli Nasabah</span>
                        <span className="font-mono font-bold text-slate-200">{formatRupiah(item.hargaBeli)}/kg</span>
                      </div>

                      <div className="text-right space-y-0.5">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Estimasi Margin Kas</span>
                        <div className="inline-flex items-center gap-1 font-mono font-bold text-emerald-400">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>+{formatRupiah(marginRupiah)}/kg</span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 text-[10px] border border-emerald-500/20">
                            +{marginPersen}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Riwayat Terakhir Diubah (Audit Trail Preview) */}
                  <div className="pt-2 border-t border-slate-800/60">
                    {item.terakhirDiubah ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/70 px-3 py-1.5 rounded-xl border border-slate-800/80">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">
                          Terakhir diubah:{" "}
                          <strong className="text-slate-300 font-medium">
                            {new Date(item.terakhirDiubah.waktu).toLocaleString("id-ID", {
                              timeZone: "Asia/Jakarta",
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}{" "}
                            WIB
                          </strong>{" "}
                          &bull;{" "}
                          <span className="text-slate-400 font-mono">
                            oleh {item.terakhirDiubah.diubahOlehNama}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic block py-0.5">
                        Harga belum pernah diubah
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions - ONLY ADMIN & SUPER ADMIN SEE "Edit Harga" BUTTON */}
                {isAdmin && (
                  <div className="pt-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-slate-200 text-xs font-bold transition-all border border-slate-700/60 active:scale-95 shadow-sm"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-emerald-400 group-hover:text-slate-950" />
                      <span>Edit Harga</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DIALOG FOR EDIT / ADD (ADMIN & SUPER ADMIN ONLY) */}
      {modalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 my-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {editingItem ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingItem ? "Edit Harga Sampah" : "Tambah Jenis Sampah Baru"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingItem
                      ? "Perbarui harga beli nasabah & harga jual ke lapak."
                      : "Daftarkan jenis sampah baru ke katalog."}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nama Jenis Sampah <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="contoh: Kardus / Karton Tebal"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-3 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Harga Beli ke Nasabah */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Harga Beli ke Nasabah (Rp/kg) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="contoh: 3000"
                  value={hargaBeli}
                  onChange={(e) => setHargaBeli(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-xl p-3 outline-none focus:border-emerald-500 transition-colors"
                />
                {hargaBeli && !isNaN(parseInt(hargaBeli, 10)) && (
                  <p className="text-[11px] text-emerald-400 font-mono mt-1.5">
                    Preview: <strong>{formatRupiah(parseInt(hargaBeli, 10))}</strong> per kg
                  </p>
                )}
              </div>

              {/* Harga Jual ke Lapak / Pengepul */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Harga Jual ke Lapak / Pengepul (Rp/kg)
                  </label>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-medium">
                    Khusus Admin
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  placeholder="contoh: 4000 (otomatis jika kosong)"
                  value={hargaJual}
                  onChange={(e) => setHargaJual(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-xl p-3 outline-none focus:border-amber-500 transition-colors"
                />
                {hargaBeli && hargaJual && !isNaN(parseInt(hargaBeli, 10)) && !isNaN(parseInt(hargaJual, 10)) && (
                  <div className="flex items-center justify-between text-[11px] mt-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                    <span className="text-slate-400">
                      Estimasi Margin:{" "}
                      <strong className={parseInt(hargaJual, 10) >= parseInt(hargaBeli, 10) ? "text-emerald-400" : "text-rose-400"}>
                        {parseInt(hargaJual, 10) >= parseInt(hargaBeli, 10) ? "+" : ""}
                        {formatRupiah(parseInt(hargaJual, 10) - parseInt(hargaBeli, 10))}/kg
                      </strong>
                    </span>
                    <span className="text-slate-400 font-medium">
                      ({(((parseInt(hargaJual, 10) - parseInt(hargaBeli, 10)) / parseInt(hargaBeli, 10)) * 100).toFixed(0)}%)
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-1">
                <label className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aktif}
                    onChange={(e) => setAktif(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Status Aktif (Tersedia untuk transaksi setor nasabah)</span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingItem ? "Simpan Harga" : "Tambah Sampah"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
