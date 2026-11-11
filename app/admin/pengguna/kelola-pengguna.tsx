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
  UserX,
  Settings2,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";
import { KelolaAkunPanel } from "./kelola-akun-panel";
import { Avatar } from "@/components/avatar";

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
  // Panel "Kelola akun" yang sedang terbuka (satu per satu) + pesan sukses hapus akun.
  const [kelolaTerbuka, setKelolaTerbuka] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

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
    <div className="space-y-6">
      <PageHeader description="Pendaftaran nasabah baru dengan ID otomatis berbasis RT, pencarian dan penyaringan pengguna, serta pengelolaan akun dan password sementara." />

      {formErrorMessage && (
        <Alert
          tone="danger"
          action={
            <button
              type="button"
              onClick={() => setFormErrorMessage(null)}
              className="text-sm font-medium underline underline-offset-2"
            >
              Tutup
            </button>
          }
        >
          {formErrorMessage}
        </Alert>
      )}

      {pesanSukses && (
        <Alert
          tone="success"
          action={
            <button type="button" onClick={() => setPesanSukses(null)} className="text-sm font-medium underline underline-offset-2">
              Tutup
            </button>
          }
        >
          {pesanSukses}
        </Alert>
      )}

      {/* Buat Pengguna Form */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <UserPlus className="size-4 text-ink-muted" aria-hidden="true" />
              {newRole === "nasabah" ? "Registrasi nasabah baru" : "Buat akun staf admin"}
            </span>
          }
          description={
            newRole === "nasabah"
              ? "ID Nasabah & Password awal ter-generate otomatis berdasarkan nomor RT."
              : "Buat akun petugas operasional bank sampah."
          }
        />

        <div className="space-y-5 p-5">
          {createResult && (
            <div className="space-y-4 rounded-control bg-success-bg p-4 ring-1 ring-success-fg/15 ring-inset" role="status">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold text-success-fg">
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                  Akun berhasil didaftarkan
                </span>
                <Button variant="secondary" onClick={handleCopyCredentials}>
                  {copied ? <Check /> : <Copy />}
                  <span>{copied ? "Tersalin" : "Salin info akun"}</span>
                </Button>
              </div>

              <dl className="grid gap-px overflow-hidden rounded-control bg-line ring-1 ring-line sm:grid-cols-3">
                <div className="bg-surface px-3.5 py-2.5">
                  <dt className="text-xs text-ink-muted">Nama lengkap</dt>
                  <dd className="font-medium text-ink">{createResult.nama}</dd>
                </div>
                <div className="bg-surface px-3.5 py-2.5">
                  <dt className="text-xs text-ink-muted">ID / Username</dt>
                  <dd className="font-semibold text-ink tabular-nums slashed-zero">{createResult.username}</dd>
                </div>
                <div className="bg-surface px-3.5 py-2.5">
                  <dt className="text-xs text-ink-muted">Password awal</dt>
                  <dd className="font-semibold tracking-wide text-ink tabular-nums slashed-zero select-all">
                    {createResult.passwordSementara}
                  </dd>
                </div>
              </dl>

              <p className="text-sm text-success-fg">
                Berikan ID Nasabah & Password awal di atas kepada nasabah. Pengguna akan diarahkan mengganti password saat pertama kali masuk.
              </p>
            </div>
          )}

          <form onSubmit={handleBuatPengguna} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Role Switcher */}
              <Field label="Jenis pengguna" htmlFor="pengguna-role" required>
                <Select
                  id="pengguna-role"
                  value={newRole}
                  onChange={(e) => handleRoleChange(e.target.value as "admin" | "nasabah")}
                >
                  <option value="nasabah">Nasabah (Warga / Penyetor)</option>
                  {isSuperAdmin && <option value="admin">Admin (Petugas)</option>}
                </Select>
              </Field>

              {/* RT Dropdown (Tampil saat role = nasabah) */}
              {newRole === "nasabah" ? (
                <Field label="Wilayah RT" htmlFor={isCustomRt ? "pengguna-rt-lain" : "pengguna-rt"} required>
                  {isCustomRt ? (
                    <div className="flex items-center gap-2">
                      <Input
                        id="pengguna-rt-lain"
                        type="text"
                        inputMode="numeric"
                        placeholder="contoh: 07"
                        value={customRt}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                          setCustomRt(val);
                          if (val) fetchNextIdForRt(val);
                        }}
                        className="tabular-nums"
                      />
                      <Button
                        variant="secondary"
                        onClick={() => setIsCustomRt(false)}
                        className="h-11 shrink-0"
                        title="Kembali ke dropdown"
                      >
                        Batal
                      </Button>
                    </div>
                  ) : (
                    <Select
                      id="pengguna-rt"
                      value={selectedRt}
                      onChange={(e) => handleRtSelectChange(e.target.value)}
                    >
                      {RT_OPTIONS.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.label} ({rt.id})
                        </option>
                      ))}
                      <option value="custom">+ Input RT Lainnya</option>
                    </Select>
                  )}
                </Field>
              ) : null}

              {/* Username / ID Nasabah Field */}
              <div className={newRole === "nasabah" ? "space-y-1.5" : "space-y-1.5 sm:col-span-2"}>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="pengguna-username" className="block text-sm font-medium text-ink">
                    {newRole === "nasabah" ? "ID Nasabah (otomatis)" : "Username staf"}
                    <span className="ml-0.5 text-danger-fg" aria-hidden="true">*</span>
                  </label>
                  {newRole === "nasabah" && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetRt = isCustomRt ? customRt : selectedRt;
                        if (targetRt) fetchNextIdForRt(targetRt);
                      }}
                      disabled={generatingId}
                      className="inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-xs font-medium text-brand hover:bg-brand-soft hover:text-brand-hover disabled:opacity-60"
                      title="Generate ulang ID"
                    >
                      <RefreshCw className={`size-3.5 ${generatingId ? "animate-spin" : ""}`} aria-hidden="true" />
                      <span>Auto-ID</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="pengguna-username"
                    type="text"
                    required
                    placeholder={newRole === "nasabah" ? "contoh: 0101" : "contoh: admin02"}
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="pr-10 tabular-nums"
                  />
                  {generatingId && (
                    <div className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted">
                      <Loader2 className="size-4 animate-spin" aria-label="Membuat ID" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Nama Lengkap Field */}
            <Field label="Nama lengkap nasabah / staf" htmlFor="pengguna-nama" required>
              <Input
                id="pengguna-nama"
                type="text"
                required
                placeholder="contoh: Ibu Sri Rahayu"
                maxLength={40}
                value={newNama}
                onChange={(e) => setNewNama(e.target.value)}
              />
            </Field>

            {/* Helper info for Nasabah */}
            {newRole === "nasabah" && newUsername && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface-muted px-4 py-3 text-sm text-ink-muted ring-1 ring-line ring-inset">
                <span>
                  ID Nasabah: <strong className="font-semibold text-ink tabular-nums">{newUsername}</strong> · Password awal:{" "}
                  <strong className="font-semibold text-ink tabular-nums">{newUsername}</strong>
                </span>
                <span className="hidden text-xs sm:inline">Format: RT (2 digit) + No. Urut</span>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full">
              <UserPlus />
              <span>{newRole === "nasabah" ? "Daftarkan nasabah baru" : "Buat akun staf"}</span>
            </Button>
          </form>
        </div>
      </Card>

      {/* Daftar Pengguna */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Users className="size-4 text-ink-muted" aria-hidden="true" />
              Daftar pengguna
            </span>
          }
          description={
            isSuperAdmin
              ? "Pencarian & manajemen seluruh pengguna (Nasabah, Admin Basic, & Super Admin)."
              : "Pencarian & manajemen daftar nasabah bank sampah."
          }
          actions={
            (urlSearch || urlRole || urlRt || urlStatus) && (
              <Button variant="secondary" onClick={handleResetFilters}>
                <RotateCcw />
                <span>Reset filter</span>
              </Button>
            )
          }
        />

        {/* Toolbar Filter */}
        <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <label htmlFor="filter-cari" className="sr-only">
              Cari pengguna
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <Input
              id="filter-cari"
              type="search"
              placeholder="Cari nama, ID, RT…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Role (Super Admin Only) */}
          {isSuperAdmin ? (
            <div>
              <label htmlFor="filter-role" className="sr-only">
                Filter role
              </label>
              <Select
                id="filter-role"
                value={urlRole}
                onChange={(e) => updateUrlParams({ role: e.target.value, page: 1 })}
              >
                <option value="">Semua Role</option>
                <option value="nasabah">Nasabah</option>
                <option value="admin">Admin Basic</option>
                <option value="super_admin">Super Admin</option>
              </Select>
            </div>
          ) : (
            <div className="flex h-11 items-center rounded-control bg-surface-muted px-3.5 text-sm text-ink-muted ring-1 ring-line ring-inset">
              Role: Nasabah
            </div>
          )}

          {/* Filter RT */}
          <div>
            <label htmlFor="filter-rt" className="sr-only">
              Filter RT
            </label>
            <Select
              id="filter-rt"
              value={urlRt}
              onChange={(e) => updateUrlParams({ rt: e.target.value, page: 1 })}
            >
              <option value="">Semua RT</option>
              {RT_OPTIONS.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.label} ({rt.id})
                </option>
              ))}
            </Select>
          </div>

          {/* Filter Status */}
          <div>
            <label htmlFor="filter-status" className="sr-only">
              Filter status
            </label>
            <Select
              id="filter-status"
              value={urlStatus}
              onChange={(e) => updateUrlParams({ status: e.target.value, page: 1 })}
            >
              <option value="">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif / Suspended</option>
            </Select>
          </div>
        </div>

        {tableError && (
          <div className="border-b border-line p-5">
            <Alert tone="danger">{tableError}</Alert>
          </div>
        )}

        {/* Daftar baris */}
        {isPending ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>Memuat data pengguna…</span>
          </div>
        ) : !dataHalaman || dataHalaman.items.length === 0 ? (
          <EmptyState
            icon={<UserX />}
            title="Tidak ada pengguna ditemukan"
            description="Coba ubah kata kunci pencarian atau bersihkan filter."
          />
        ) : (
          <ul className="divide-y divide-line">
            {dataHalaman.items.map((user) => {
              const isSelf = user.id === sesi?.userId;
              const terbuka = kelolaTerbuka === user.id;

              return (
                <li key={user.id} className="px-5 py-3.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar nama={user.nama} userId={user.id} fotoVersi={user.fotoVersi} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{user.nama}</p>
                      <p className="text-sm text-ink-muted">
                        <span className="tabular-nums">{user.username}</span>
                        {" · "}
                        <span className="tabular-nums">{user.rt ? `RT ${user.rt}` : "-"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pl-13 sm:pl-0">
                    {user.role === "super_admin" && <Badge tone="warning">Super Admin</Badge>}
                    {user.role === "admin" && <Badge tone="info">Admin Basic</Badge>}
                    {user.role === "nasabah" && <Badge tone="brand">Nasabah</Badge>}
                    <Badge tone={user.aktif ? "success" : "danger"}>{user.aktif ? "Aktif" : "Nonaktif"}</Badge>
                  </div>

                  {isSuperAdmin && !isSelf && (
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => setKelolaTerbuka(terbuka ? null : user.id)}
                      aria-expanded={terbuka}
                      aria-controls={`kelola-${user.id}`}
                      className="w-full sm:w-auto"
                    >
                      <Settings2 />
                      <span>{terbuka ? "Tutup" : "Kelola akun"}</span>
                    </Button>
                  )}
                </div>

                {isSuperAdmin && !isSelf && terbuka && (
                  <div id={`kelola-${user.id}`} className="mt-3">
                    <KelolaAkunPanel
                      pengguna={user}
                      onBerubah={fetchTableData}
                      onTerhapus={(pesan) => {
                        setKelolaTerbuka(null);
                        setPesanSukses(pesan);
                        fetchTableData();
                      }}
                    />
                  </div>
                )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination Controls */}
        {dataHalaman && dataHalaman.total > 0 && (
          <div className="flex flex-col gap-3 border-t border-line px-5 py-3 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Menampilkan <strong className="font-semibold text-ink tabular-nums">{startRow}</strong>–
                <strong className="font-semibold text-ink tabular-nums">{endRow}</strong> dari{" "}
                <strong className="font-semibold text-ink tabular-nums">{dataHalaman.total}</strong> pengguna
              </span>

              {/* Baris per halaman selector */}
              <div className="flex items-center gap-2">
                <label htmlFor="filter-limit" className="text-xs">
                  Baris
                </label>
                <Select
                  id="filter-limit"
                  value={urlLimit}
                  onChange={(e) =>
                    updateUrlParams({ limit: parseInt(e.target.value, 10), page: 1 })
                  }
                  className="h-10 w-20 tabular-nums"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums">
                Halaman {page} dari {totalPages}
              </span>
              <Button
                variant="secondary"
                size="icon"
                disabled={page <= 1 || isPending}
                onClick={() => updateUrlParams({ page: page - 1 })}
                title="Halaman Sebelumnya"
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                disabled={page >= totalPages || isPending}
                onClick={() => updateUrlParams({ page: page + 1 })}
                title="Halaman Selanjutnya"
                aria-label="Halaman selanjutnya"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
