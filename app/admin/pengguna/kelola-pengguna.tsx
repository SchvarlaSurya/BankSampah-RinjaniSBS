"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { actions } from "@/lib/api/actions";
import {
  type HalamanPengguna,
  ERROR_MESSAGES,
  type SesiInfo,
} from "@/contract";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Building2,
  Hash,
  Copy,
  Check,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ResetPasswordDialog from "@/components/ResetPasswordDialog";

export const RT_OPTIONS = [
  { id: "01", label: "RT 01" },
  { id: "02", label: "RT 02" },
  { id: "03", label: "RT 03" },
  { id: "04", label: "RT 04" },
  { id: "05", label: "RT 05" },
  { id: "06", label: "RT 06" },
  { id: "07", label: "RT 07" },
  { id: "08", label: "RT 08" },
  { id: "09", label: "RT 09" },
  { id: "10", label: "RT 10" },
  { id: "11", label: "RT 11" },
  { id: "12", label: "RT 12" },
] as const;

/** Daftar pengguna (sesuai filter di URL) dibaca Server Component page.tsx; setelah mutasi, router.refresh(). */
export function KelolaPengguna({
  sesi,
  dataHalaman,
  tableError,
}: {
  sesi: SesiInfo;
  dataHalaman: HalamanPengguna | null;
  tableError: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Form Registrasi State
  const [newRole, setNewRole] = useState<"admin" | "nasabah">("nasabah");
  const [selectedRt, setSelectedRt] = useState<string>("01");
  const [customRt, setCustomRt] = useState<string>("");
  const [isCustomRt, setIsCustomRt] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newNama, setNewNama] = useState("");
  const [generatingId, setGeneratingId] = useState(false);
  const [createResult, setCreateResult] = useState<{
    username: string;
    nama: string;
    role: string;
    passwordSementara: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  // Read Filter parameters from URL
  const urlSearch = searchParams.get("search") || "";
  const urlRole = searchParams.get("role") || "";
  const urlRt = searchParams.get("rt") || "";
  const urlStatus = searchParams.get("status") || "";
  const urlLimit = parseInt(searchParams.get("limit") || "20", 10);

  // Local state for debounced search input
  const [searchInput, setSearchInput] = useState(urlSearch);

  const isSuperAdmin = sesi?.role === "super_admin";

  // Sinkronkan input cari bila URL berubah dari luar (mis. tombol reset / navigasi).
  const [searchDariUrl, setSearchDariUrl] = useState(urlSearch);
  if (searchDariUrl !== urlSearch) {
    setSearchDariUrl(urlSearch);
    setSearchInput(urlSearch);
  }

  const timerCari = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function handleSearchChange(nilai: string) {
    setSearchInput(nilai);
    clearTimeout(timerCari.current);
    timerCari.current = setTimeout(() => updateUrlParams({ search: nilai, page: 1 }), 400);
  }
  useEffect(() => () => clearTimeout(timerCari.current), []);

  const updateUrlParams = (newParams: {
      search?: string;
      role?: string;
      rt?: string;
      status?: string;
      page?: number;
      limit?: number;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (newParams.search !== undefined) {
        if (newParams.search) params.set("search", newParams.search);
        else params.delete("search");
      }
      if (newParams.role !== undefined) {
        if (newParams.role) params.set("role", newParams.role);
        else params.delete("role");
      }
      if (newParams.rt !== undefined) {
        if (newParams.rt) params.set("rt", newParams.rt);
        else params.delete("rt");
      }
      if (newParams.status !== undefined) {
        if (newParams.status) params.set("status", newParams.status);
        else params.delete("status");
      }
      if (newParams.page !== undefined) {
        if (newParams.page > 1) params.set("page", String(newParams.page));
        else params.delete("page");
      }
      if (newParams.limit !== undefined) {
        if (newParams.limit !== 20) params.set("limit", String(newParams.limit));
        else params.delete("limit");
      }

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    };

  const fetchTableData = () => startTransition(() => router.refresh());

  // Generate ID otomatis untuk registrasi nasabah
  async function fetchNextIdForRt(rtNumber: string) {
    if (!rtNumber.trim()) return;
    setGeneratingId(true);
    try {
      const res = await actions.getLatestIdByRt({ rtNumber });
      if (res.ok) {
        setNewUsername(res.data.nextId);
      }
    } catch (err) {
      console.error("Gagal men-generate ID:", err);
    } finally {
      setGeneratingId(false);
    }
  }

  const rtTarget = newRole === "nasabah" ? (isCustomRt ? customRt : selectedRt) : "";
  useEffect(() => {
    if (!rtTarget) return;
    // Jeda kecil: RT kustom diketik per karakter.
    const t = setTimeout(() => void fetchNextIdForRt(rtTarget), 300);
    return () => clearTimeout(t);
  }, [rtTarget]);

  function handleRoleChange(role: "admin" | "nasabah") {
    setNewRole(role);
    setFormErrorMessage(null);
    setCreateResult(null);
    if (role !== "nasabah") setNewUsername("");
  }

  function handleRtSelectChange(rt: string) {
    if (rt === "custom") {
      setIsCustomRt(true);
    } else {
      setIsCustomRt(false);
      setSelectedRt(rt);
    }
  }

  async function handleBuatPengguna(e: React.FormEvent) {
    e.preventDefault();
    setFormErrorMessage(null);
    setCreateResult(null);

    const res = await actions.buatPengguna({
      role: newRole,
      username: newUsername.trim(),
      nama: newNama.trim(),
    });

    if (!res.ok) {
      // Pesan spesifik per field (mis. nama berisi kata terlarang) lebih jelas dari pesan umum.
      const pesanField = res.fieldErrors ? Object.values(res.fieldErrors).flat()[0] : undefined;
      setFormErrorMessage(pesanField || res.message || ERROR_MESSAGES[res.code]);
    } else {
      setCreateResult({
        username: res.data.pengguna.username,
        nama: res.data.pengguna.nama,
        role: res.data.pengguna.role,
        passwordSementara: res.data.passwordSementara,
      });
      setNewNama("");
      if (newRole === "nasabah") {
        const targetRt = isCustomRt ? customRt : selectedRt;
        fetchNextIdForRt(targetRt);
      } else {
        setNewUsername("");
      }
      fetchTableData();
    }
  }

  async function handleToggleStatus(userId: string, currentAktif: boolean) {
    const res = await actions.setStatusPengguna({ userId, aktif: !currentAktif });
    if (res.ok) {
      fetchTableData();
    }
  }

  function handleCopyCredentials() {
    if (!createResult) return;
    const text = `Akun Bank Sampah Rinjani SBS:\nID Nasabah / Username: ${createResult.username}\nPassword Sementara: ${createResult.passwordSementara}\nNama: ${createResult.nama}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleResetFilters() {
    clearTimeout(timerCari.current);
    setSearchInput("");
    router.push(pathname);
  }

  const page = dataHalaman ? Math.floor(dataHalaman.offset / dataHalaman.limit) + 1 : 1;
  const totalPages = dataHalaman ? Math.ceil(dataHalaman.total / dataHalaman.limit) : 1;
  const startRow = dataHalaman && dataHalaman.total > 0 ? dataHalaman.offset + 1 : 0;
  const endRow = dataHalaman ? Math.min(dataHalaman.offset + dataHalaman.items.length, dataHalaman.total) : 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-3 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <Users className="w-3.5 h-3.5" />
          <span>{isSuperAdmin ? "Super Admin Access" : "Admin Dashboard"}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Kelola Pengguna & Registrasi Nasabah
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
          Pendaftaran nasabah baru dengan auto-ID berbasis RT, pencarian, penyaringan kriteria pengguna, serta manajemen akun & password sementara.
        </p>
      </div>

      {formErrorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-md animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{formErrorMessage}</span>
          </div>
          <button
            onClick={() => setFormErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-xs underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Buat Pengguna Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {newRole === "nasabah" ? "Registrasi Nasabah Baru" : "Buat Akun Staf Admin"}
              </h2>
              <p className="text-xs text-slate-400">
                {newRole === "nasabah"
                  ? "ID Nasabah & Password awal ter-generate otomatis berdasarkan nomor RT."
                  : "Buat akun petugas operasional bank sampah."}
              </p>
            </div>
          </div>
        </div>

        {createResult && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 text-emerald-200 text-xs space-y-3 shadow-lg animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Akun Berhasil Didaftarkan!
              </span>
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors border border-emerald-500/30"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Tersalin!" : "Salin Info Akun"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-slate-300">
              <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">Nama Lengkap</span>
                <span className="font-bold text-slate-100 text-xs">{createResult.nama}</span>
              </div>
              <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">ID / Username</span>
                <span className="font-mono font-bold text-emerald-400 text-xs">{createResult.username}</span>
              </div>
              <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">Password Awal</span>
                <span className="font-mono font-bold text-amber-400 text-xs">{createResult.passwordSementara}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              *Berikan ID Nasabah & Password awal di atas kepada nasabah. Pengguna akan diarahkan mengganti password saat pertama kali masuk.
            </p>
          </div>
        )}

        <form onSubmit={handleBuatPengguna} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Role Switcher */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Jenis Pengguna <span className="text-rose-400">*</span>
              </label>
              <select
                value={newRole}
                onChange={(e) => handleRoleChange(e.target.value as "admin" | "nasabah")}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-3 outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="nasabah">Nasabah (Warga / Penyetor)</option>
                {isSuperAdmin && <option value="admin">Admin (Petugas)</option>}
              </select>
            </div>

            {/* RT Dropdown (Tampil saat role = nasabah) */}
            {newRole === "nasabah" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pilih Wilayah RT</span> <span className="text-rose-400">*</span>
                </label>
                {isCustomRt ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="contoh: 07"
                      value={customRt}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setCustomRt(val);
                        if (val) fetchNextIdForRt(val);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-xl p-3 outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomRt(false)}
                      className="px-2.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                      title="Kembali ke dropdown"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedRt}
                    onChange={(e) => handleRtSelectChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-3 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                  >
                    {RT_OPTIONS.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.label} ({rt.id})
                      </option>
                    ))}
                    <option value="custom">+ Input RT Lainnya</option>
                  </select>
                )}
              </div>
            ) : null}

            {/* Username / ID Nasabah Field */}
            <div className={newRole === "nasabah" ? "" : "sm:col-span-2"}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{newRole === "nasabah" ? "ID Nasabah (Auto)" : "Username Staf"}</span>
                  <span className="text-rose-400">*</span>
                </label>
                {newRole === "nasabah" && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetRt = isCustomRt ? customRt : selectedRt;
                      if (targetRt) fetchNextIdForRt(targetRt);
                    }}
                    disabled={generatingId}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    title="Generate ulang ID"
                  >
                    <RefreshCw className={`w-3 h-3 ${generatingId ? "animate-spin" : ""}`} />
                    <span>Auto-ID</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder={newRole === "nasabah" ? "contoh: 0101" : "contoh: admin02"}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-xl p-3 outline-none focus:border-emerald-500 transition-colors"
                />
                {generatingId && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nama Lengkap Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nama Lengkap Nasabah / Staf <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="contoh: Ibu Sri Rahayu"
              maxLength={40}
              value={newNama}
              onChange={(e) => setNewNama(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-3 outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Helper info for Nasabah */}
          {newRole === "nasabah" && newUsername && (
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-3 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  ID Nasabah: <strong className="text-emerald-400 font-mono">{newUsername}</strong> &bull; Password Awal: <strong className="text-amber-400 font-mono">{newUsername}</strong>
                </span>
              </div>
              <span className="text-slate-400 hidden sm:inline">Format: RT (2 digit) + No. Urut</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl py-3 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>{newRole === "nasabah" ? "Daftarkan Nasabah Baru" : "Buat Akun Staf"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Tabel & Toolbar Pengguna Terpadu */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span>Daftar Pengguna Sistem</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isSuperAdmin
                ? "Pencarian & manajemen seluruh pengguna (Nasabah, Admin Basic, & Super Admin)."
                : "Pencarian & manajemen daftar nasabah bank sampah."}
            </p>
          </div>

          {(urlSearch || urlRole || urlRt || urlStatus) && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 self-start sm:self-auto transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {/* Toolbar Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Input Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, ID, RT..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Filter Role (Super Admin Only) */}
          {isSuperAdmin ? (
            <div>
              <select
                value={urlRole}
                onChange={(e) => updateUrlParams({ role: e.target.value, page: 1 })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="">Semua Role</option>
                <option value="nasabah">Nasabah</option>
                <option value="admin">Admin Basic</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          ) : (
            <div>
              <div className="w-full bg-slate-950/60 border border-slate-800/80 text-slate-400 text-xs rounded-xl px-3 py-2.5">
                Role: Nasabah
              </div>
            </div>
          )}

          {/* Filter RT */}
          <div>
            <select
              value={urlRt}
              onChange={(e) => updateUrlParams({ rt: e.target.value, page: 1 })}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
            >
              <option value="">Semua RT</option>
              {RT_OPTIONS.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.label} ({rt.id})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <select
              value={urlStatus}
              onChange={(e) => updateUrlParams({ status: e.target.value, page: 1 })}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
            >
              <option value="">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif / Suspended</option>
            </select>
          </div>
        </div>

        {/* Tabel Result */}
        {tableError && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{tableError}</span>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">ID / Username</th>
                <th className="px-4 py-3">Nama Lengkap</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">RT</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isPending ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="inline-flex items-center gap-2 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Memuat data pengguna...</span>
                    </div>
                  </td>
                </tr>
              ) : !dataHalaman || dataHalaman.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UserX className="w-8 h-8 text-slate-600" />
                      <p className="font-semibold text-slate-400">Tidak ada pengguna ditemukan</p>
                      <p className="text-[11px] text-slate-500">
                        Coba ubah kata kunci pencarian atau bersihkan filter kriteria.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                dataHalaman.items.map((user) => {
                  const isTargetSuperAdmin = user.role === "super_admin";
                  const isSelf = user.id === sesi?.userId;

                  return (
                    <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-200">
                        {user.username}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-100">
                        {user.nama}
                      </td>
                      <td className="px-4 py-3.5">
                        {user.role === "super_admin" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            Super Admin
                          </span>
                        )}
                        {user.role === "admin" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/10 border border-sky-500/20 text-sky-400">
                            Admin Basic
                          </span>
                        )}
                        {user.role === "nasabah" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            Nasabah
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-400">
                        {user.rt ? `RT ${user.rt}` : "-"}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            user.aktif
                              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                              : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                          }`}
                        >
                          {user.aktif ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Reset Password Button: Hanya untuk super_admin, pada akun non-super_admin dan bukan diri sendiri */}
                          {isSuperAdmin && !isTargetSuperAdmin && !isSelf && (
                            <ResetPasswordDialog
                              userId={user.id}
                              username={user.username}
                              nama={user.nama}
                              role={user.role}
                            />
                          )}

                          {/* Toggle Status Button */}
                          {isSuperAdmin && !isSelf && (
                            <button
                              onClick={() => handleToggleStatus(user.id, user.aktif)}
                              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${
                                user.aktif
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-400"
                                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-emerald-500/10 hover:text-emerald-400"
                              }`}
                            >
                              {user.aktif ? (
                                <UserCheck className="w-3.5 h-3.5" />
                              ) : (
                                <UserX className="w-3.5 h-3.5" />
                              )}
                              <span className="hidden sm:inline">
                                {user.aktif ? "Aktif" : "Nonaktif"}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {dataHalaman && dataHalaman.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span>
                Menampilkan <strong className="text-slate-200">{startRow}</strong> -{" "}
                <strong className="text-slate-200">{endRow}</strong> dari{" "}
                <strong className="text-slate-200">{dataHalaman.total}</strong> pengguna
              </span>

              {/* Baris per halaman selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Baris:</span>
                <select
                  value={urlLimit}
                  onChange={(e) =>
                    updateUrlParams({ limit: parseInt(e.target.value, 10), page: 1 })
                  }
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">
                Halaman {page} dari {totalPages}
              </span>

              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1 || isPending}
                  onClick={() => updateUrlParams({ page: page - 1 })}
                  className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  disabled={page >= totalPages || isPending}
                  onClick={() => updateUrlParams({ page: page + 1 })}
                  className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Halaman Selanjutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

