"use client";

import { useState, useEffect } from "react";
import { queries } from "@/src/lib/api/queries";
import { actions } from "@/src/lib/api/actions";
import { JenisSampah, formatRupiah, ERROR_MESSAGES } from "@/src/contract";
import { Trash2, Plus, Edit2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function MasterJenisSampahPage() {
  const [list, setList] = useState<JenisSampah[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [nama, setNama] = useState("");
  const [hargaBeli, setHargaBeli] = useState("");
  const [aktif, setAktif] = useState(true);

  async function loadData() {
    setLoading(true);
    const res = await queries.listJenisSampah({ termasukNonaktif: true });
    if (res.ok) {
      setList(res.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleEdit(item: JenisSampah) {
    setEditingId(item.id);
    setNama(item.nama);
    setHargaBeli(item.hargaBeli.toString());
    setAktif(item.aktif);
  }

  function handleResetForm() {
    setEditingId(undefined);
    setNama("");
    setHargaBeli("");
    setAktif(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const harga = parseInt(hargaBeli, 10);
    if (isNaN(harga) || harga <= 0) {
      setErrorMessage("Harga beli per kg harus bilangan bulat positif.");
      return;
    }

    const res = await actions.simpanJenisSampah({
      id: editingId,
      nama: nama.trim(),
      hargaBeli: harga,
      aktif,
    });

    if (!res.ok) {
      setErrorMessage(res.message || ERROR_MESSAGES[res.code]);
    } else {
      handleResetForm();
      loadData();
    }
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-3 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <Trash2 className="w-3.5 h-3.5" />
          <span>Super Admin Access</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Master Jenis Sampah & Harga</h1>
        <p className="text-xs text-slate-400">
          Kelola nama kategori sampah, harga beli per kg, dan status aktif.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form Tambah/Edit */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-lg">
        <h2 className="text-base font-bold text-slate-200 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            {editingId ? "Edit Jenis Sampah" : "Tambah Jenis Sampah Baru"}
          </span>
          {editingId && (
            <button
              onClick={handleResetForm}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Batal Edit
            </button>
          )}
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Nama Jenis Sampah</label>
            <input
              type="text"
              required
              placeholder="contoh: Plastik PET"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Harga Beli / kg (Rp)</label>
            <input
              type="number"
              required
              min={1}
              placeholder="contoh: 2500"
              value={hargaBeli}
              onChange={(e) => setHargaBeli(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-5">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={aktif}
                onChange={(e) => setAktif(e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Status Aktif</span>
            </label>
          </div>

          <div className="sm:col-span-3 pt-2">
            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl py-3"
            >
              {editingId ? "Simpan Perubahan" : "Tambah Jenis Sampah"}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-200">Daftar Jenis Sampah</h2>

        {loading ? (
          <div className="py-8 text-center text-slate-500 text-xs flex justify-center items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Memuat data jenis sampah...</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {list.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <p className="font-bold text-slate-200">{item.nama}</p>
                  <p className="text-emerald-400 font-mono font-semibold">{formatRupiah(item.hargaBeli)} / kg</p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      item.aktif
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {item.aktif ? "Aktif" : "Nonaktif"}
                  </span>

                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 font-semibold"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
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
