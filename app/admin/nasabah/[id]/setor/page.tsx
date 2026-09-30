"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { queries } from "@/src/lib/api/queries";
import { actions } from "@/src/lib/api/actions";
import {
  JenisSampah,
  NasabahRingkas,
  SetorItemSchema,
  buildSetorFormData,
  estimasiSubtotal,
  formatRupiah,
  normalisasiBerat,
  ERROR_MESSAGES,
  FOTO_MIME,
} from "@/src/contract";
import {
  ArrowLeft,
  ArrowDownLeft,
  Trash2,
  Plus,
  Camera,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Scale,
  DollarSign,
} from "lucide-react";

export default function SetorSampahPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: customerId } = use(params);
  const router = useRouter();

  // Idempotency UUID created once per form open
  const clientRequestIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000"
  );

  const photoInputRef = useRef<HTMLInputElement>(null);

  const [nasabah, setNasabah] = useState<NasabahRingkas | null>(null);
  const [jenisSampahList, setJenisSampahList] = useState<JenisSampah[]>([]);
  const [items, setItems] = useState<{ wasteTypeId: string; berat: string }[]>([
    { wasteTypeId: "", berat: "" },
  ]);
  const [catatan, setCatatan] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [successData, setSuccessData] = useState<{
    saldoBaru: number;
    duplikat: boolean;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      const [nRes, jsRes] = await Promise.all([
        queries.getNasabah({ customerId }),
        queries.listJenisSampah({ termasukNonaktif: false }),
      ]);
      if (nRes.ok) setNasabah(nRes.data);
      if (jsRes.ok) {
        setJenisSampahList(jsRes.data);
        if (jsRes.data.length > 0) {
          setItems([{ wasteTypeId: jsRes.data[0].id, berat: "" }]);
        }
      }
    }
    loadData();
  }, [customerId]);

  function handleAddItem() {
    if (jenisSampahList.length === 0) return;
    setItems((prev) => [...prev, { wasteTypeId: jenisSampahList[0].id, berat: "" }]);
  }

  function handleRemoveItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleItemChange(index: number, field: "wasteTypeId" | "berat", value: string) {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!FOTO_MIME.includes(file.type as any)) {
      setErrorMessage(ERROR_MESSAGES.FOTO_TIDAK_VALID);
      return;
    }

    setFotoFile(file);
    const url = URL.createObjectURL(file);
    setFotoPreview(url);
    setErrorMessage(null);
  }

  // Calculate estimated total sum
  const totalEstimasi = items.reduce((sum, item) => {
    const js = jenisSampahList.find((j) => j.id === item.wasteTypeId);
    if (!js || !item.berat) return sum;
    try {
      const norm = normalisasiBerat(item.berat);
      return sum + estimasiSubtotal(norm, js.hargaBeli);
    } catch {
      return sum;
    }
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (!fotoFile) {
      setErrorMessage(ERROR_MESSAGES.FOTO_WAJIB);
      photoInputRef.current?.focus();
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setFieldErrors({});

    try {
      const formData = buildSetorFormData(
        {
          customerId,
          items: items.map((i) => ({ wasteTypeId: i.wasteTypeId, berat: i.berat })),
          catatan: catatan || undefined,
          clientRequestId: clientRequestIdRef.current,
        },
        fotoFile
      );

      const res = await actions.setor(formData);

      if (!res.ok) {
        if (
          res.code === "FOTO_WAJIB" ||
          res.code === "FOTO_TIDAK_VALID" ||
          res.code === "FOTO_SUDAH_DIPAKAI"
        ) {
          photoInputRef.current?.focus();
        }
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        setErrorMessage(res.message || ERROR_MESSAGES[res.code]);
      } else {
        setSuccessData({
          saldoBaru: res.data.saldoBaru,
          duplikat: res.data.duplikat,
        });
      }
    } catch {
      setErrorMessage(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  }

  if (successData) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Setor Sampah Berhasil!</h1>
            {successData.duplikat && (
              <p className="text-xs text-amber-400 mt-1">
                (Transaksi ini sudah pernah diproses sebelumnya / Idemopotent)
              </p>
            )}
            <p className="text-sm text-slate-400 mt-2">
              Saldo nasabah <span className="font-semibold text-slate-200">{nasabah?.nama}</span> telah diperbarui.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
            <span className="text-xs text-slate-400 block mb-1">Saldo Terkini Nasabah</span>
            <span className="text-3xl font-extrabold text-emerald-400 font-mono">
              {formatRupiah(successData.saldoBaru)}
            </span>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setSuccessData(null);
                clientRequestIdRef.current = crypto.randomUUID();
                setFotoFile(null);
                setFotoPreview(null);
                setItems([{ wasteTypeId: jenisSampahList[0]?.id || "", berat: "" }]);
              }}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl py-3"
            >
              Setor Lagi
            </button>
            <Link
              href={`/admin/nasabah/${customerId}`}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl py-3 text-center"
            >
              Kembali ke Nasabah
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/admin/nasabah/${customerId}`}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Batal & Kembali ke Nasabah</span>
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-2xl">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Form Penimbangan & Setor Sampah</h1>
            {nasabah && (
              <p className="text-xs text-slate-400 mt-1">
                Nasabah: <span className="text-emerald-400 font-semibold">{nasabah.nama}</span> ({nasabah.username})
              </p>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                Daftar Barang & Timbangan Sampah
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Jenis Sampah
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const selectedJs = jenisSampahList.find((j) => j.id === item.wasteTypeId);
                let estimasi = 0;
                if (selectedJs && item.berat) {
                  try {
                    const norm = normalisasiBerat(item.berat);
                    estimasi = estimasiSubtotal(norm, selectedJs.hargaBeli);
                  } catch {}
                }

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-400">Item #{idx + 1}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-500/10 rounded-lg text-xs"
                          title="Hapus Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Jenis Sampah
                        </label>
                        <select
                          value={item.wasteTypeId}
                          onChange={(e) => handleItemChange(idx, "wasteTypeId", e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500"
                        >
                          {jenisSampahList.map((js) => (
                            <option key={js.id} value={js.id}>
                              {js.nama} — {formatRupiah(js.hargaBeli)}/kg
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Berat Timbangan (kg)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="contoh: 12.50"
                          value={item.berat}
                          onChange={(e) => handleItemChange(idx, "berat", e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 placeholder-slate-600"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                      <span className="text-slate-500 italic">Subtotal (Perkiraan):</span>
                      <span className="font-bold font-mono text-emerald-400">
                        {formatRupiah(estimasi)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Estimated Preview */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Total Nilai Setor (Perkiraan)
              </span>
              <span className="text-xl font-extrabold text-emerald-400 font-mono">
                {formatRupiah(totalEstimasi)}
              </span>
            </div>
          </div>

          {/* Photo Upload Section */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              Upload Foto Timbangan (Wajib)
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                className="hidden"
                id="foto-input"
              />

              <label
                htmlFor="foto-input"
                className="w-full sm:w-auto bg-slate-950 hover:bg-slate-800 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center group"
              >
                <Camera className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 mb-2 transition-colors" />
                <span className="text-xs font-semibold text-slate-200">Pilih Foto Timbangan</span>
                <span className="text-[10px] text-slate-500 mt-1">JPG, PNG, atau WebP (Maks 500 KB)</span>
              </label>

              {fotoPreview && (
                <div className="relative w-32 h-32 rounded-2xl overflow-hidden border border-emerald-500/40 shadow-lg shrink-0">
                  <img src={fotoPreview} alt="Pratinjau Foto" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-950/80 text-[10px] text-emerald-400 font-medium">
                    Terlampir
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Catatan Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Catatan (Opsional)
            </label>
            <textarea
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan tambahan mengenai kondisi timbangan atau sampah..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 placeholder-slate-600 text-xs rounded-xl p-3 outline-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl py-3.5 px-4 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 mt-4"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Setor Sampah...</span>
              </>
            ) : (
              <span>Proses Transaksi Setor</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
