"use client";

import { useState, useEffect } from "react";
import { queries } from "@/src/lib/api/queries";
import { actions } from "@/src/lib/api/actions";
import { PenggunaRingkas, ERROR_MESSAGES } from "@/src/contract";
import { Users, UserPlus, KeyRound, UserCheck, UserX, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function KelolaPenggunaPage() {
  const [stafList, setStafList] = useState<PenggunaRingkas[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Buat Pengguna
  const [newRole, setNewRole] = useState<"admin" | "nasabah">("nasabah");
  const [newUsername, setNewUsername] = useState("");
  const [newNama, setNewNama] = useState("");
  const [createResult, setCreateResult] = useState<{ passwordSementara: string } | null>(null);

  // Reset Password Modal
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ passwordSementara: string } | null>(null);

  async function loadData() {
    setLoading(true);
    const res = await queries.listStaf();
    if (res.ok) {
      setStafList(res.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleBuatPengguna(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setCreateResult(null);

    const res = await actions.buatPengguna({
      role: newRole,
      username: newUsername,
      nama: newNama,
    });

    if (!res.ok) {
      setErrorMessage(res.message || ERROR_MESSAGES[res.code]);
    } else {
      setCreateResult({ passwordSementara: res.data.passwordSementara });
      setNewUsername("");
      setNewNama("");
      loadData();
    }
  }

  async function handleResetPassword(userId: string) {
    setErrorMessage(null);
    const res = await actions.resetPasswordPengguna({ userId });
    if (!res.ok) {
      setErrorMessage(res.message || ERROR_MESSAGES[res.code]);
    } else {
      setResetResult({ passwordSementara: res.data.passwordSementara });
      setResetTargetId(null);
    }
  }

  async function handleToggleStatus(userId: string, currentAktif: boolean) {
    const res = await actions.setStatusPengguna({ userId, aktif: !currentAktif });
    if (res.ok) {
      loadData();
    }
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-3 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <Users className="w-3.5 h-3.5" />
          <span>Super Admin Access</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Kelola Pengguna & Staf</h1>
        <p className="text-xs text-slate-400">
          Buat akun baru untuk Admin/Nasabah, atur status aktif, dan reset password sementara.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Buat Pengguna Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-lg">
        <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-emerald-400" />
          <span>Buat Pengguna Baru</span>
        </h2>

        {createResult && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Pengguna Berhasil Dibuat!
            </p>
            <p>
              Password Sementara: <span className="font-mono font-bold bg-slate-950 px-2 py-0.5 rounded text-amber-400">{createResult.passwordSementara}</span>
            </p>
            <p className="text-[11px] text-slate-400 italic">
              *Catat password sementara ini. Pengguna akan diminta menggantinya saat login pertama.
            </p>
          </div>
        )}

        <form onSubmit={handleBuatPengguna} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
            >
              <option value="nasabah">Nasabah</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Username / ID</label>
            <input
              type="text"
              required
              placeholder="contoh: admin02"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Nama Lengkap</label>
            <input
              type="text"
              required
              placeholder="contoh: Ahmad Subagyo"
              value={newNama}
              onChange={(e) => setNewNama(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-3 pt-2">
            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl py-3"
            >
              Buat Akun Pengguna
            </button>
          </div>
        </form>
      </div>

      {/* Reset Password Modal Result */}
      {resetResult && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
          <p className="font-bold">Password Telah Direset!</p>
          <p>
            Password Sementara Baru: <span className="font-mono font-bold bg-slate-950 px-2 py-0.5 rounded text-amber-400">{resetResult.passwordSementara}</span>
          </p>
        </div>
      )}

      {/* Staf List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-200">Daftar Staf (Admin & Super Admin)</h2>

        {loading ? (
          <div className="py-8 text-center text-slate-500 text-xs flex justify-center items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Memuat data staf...</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {stafList.map((staf) => (
              <div key={staf.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <p className="font-bold text-slate-200">{staf.nama}</p>
                  <p className="text-slate-500 font-mono">@{staf.username} &bull; {staf.role}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResetPassword(staf.id)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs flex items-center gap-1 font-semibold"
                    title="Reset Password"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>

                  <button
                    onClick={() => handleToggleStatus(staf.id, staf.aktif)}
                    className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                      staf.aktif
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {staf.aktif ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                    <span>{staf.aktif ? "Aktif" : "Nonaktif"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
