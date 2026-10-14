"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { actions } from "@/lib/api/actions";
import {
  type JenisSampah,
  type NasabahRingkas,
  buildSetorFormData,
  estimasiSubtotal,
  formatRupiah,
  normalisasiBerat,
  ERROR_MESSAGES,
  FOTO_MIME,
  LIMIT,
  SetorItemSchema,
} from "@/contract";
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

/** "1.500.000" byte -> "1,5 MB" untuk pesan ke pengguna. */
const BATAS_FOTO = `${(LIMIT.FOTO_MAKS_BYTES / 1_000_000).toLocaleString("id-ID")} MB`;

/** Koma desimal -> titik; titik di akhir dibuang ("12," -> "12"). */
const beratBersih = (berat: string) => berat.trim().replace(/,/g, ".").replace(/\.$/, "");

/** Data nasabah & jenis sampah datang dari Server Component (page.tsx). */
export function SetorForm({
  customerId,
  nasabah,
  jenisSampahList,
}: {
  customerId: string;
  nasabah: NasabahRingkas;
  jenisSampahList: JenisSampah[];
}) {

  // Idempotency UUID created once per form open
  const clientRequestIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000"
  );

  const photoInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<{ wasteTypeId: string; berat: string }[]>([
    { wasteTypeId: jenisSampahList[0]?.id ?? "", berat: "" },
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

  function handleAddItem() {
    if (jenisSampahList.length === 0) return;
    const unusedJs = jenisSampahList.find(
      (js) => !items.some((it) => it.wasteTypeId === js.id)
    );
    setItems((prev) => [
      ...prev,
      { wasteTypeId: unusedJs ? unusedJs.id : jenisSampahList[0].id, berat: "" },
    ]);
  }

  function handleRemoveItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
    setFieldErrors({});
    setErrorMessage(null);
  }

  function handleItemChange(index: number, field: "wasteTypeId" | "berat", value: string) {
    const finalValue = field === "berat" ? value.replace(/,/g, ".") : value;
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: finalValue };
      return copy;
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`items.${index}.${field}`];
      delete next["items"];
      return next;
    });
    setErrorMessage(null);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!(FOTO_MIME as readonly string[]).includes(file.type)) {
      setErrorMessage(ERROR_MESSAGES.FOTO_TIDAK_VALID);
      if (photoInputRef.current) photoInputRef.current.value = "";
      return;
    }

    if (file.size > LIMIT.FOTO_MAKS_BYTES) {
      setErrorMessage(`Ukuran foto melebihi batas maksimal (${BATAS_FOTO}).`);
      if (photoInputRef.current) photoInputRef.current.value = "";
      return;
    }

    setFotoFile(file);
    const url = URL.createObjectURL(file);
    setFotoPreview(url);
    setErrorMessage(null);
  }

  function handleHapusFoto() {
    setFotoFile(null);
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
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

    setErrorMessage(null);
    setFieldErrors({});

    // 1. Validasi minimal 1 item
    if (items.length === 0) {
      setErrorMessage("Minimal 1 jenis sampah harus ditambahkan.");
      return;
    }

    // 2. Validasi kelengkapan & kevalidan berat setiap item
    const errors: Record<string, string[]> = {};
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const itemLabel = items.length > 1 ? `Item #${idx + 1}` : "Item";

      if (!item.wasteTypeId) {
        errors[`items.${idx}.wasteTypeId`] = [`Pilih jenis sampah pada ${itemLabel}.`];
      }

      if (!item.berat || item.berat.trim() === "") {
        errors[`items.${idx}.berat`] = [`Berat pada ${itemLabel} belum diisi.`];
      } else {
        // Aturan berat sama dengan server (string desimal, maks 2 angka di belakang titik).
        const cek = SetorItemSchema.shape.berat.safeParse(beratBersih(item.berat));
        if (!cek.success) {
          errors[`items.${idx}.berat`] = [`${itemLabel}: ${cek.error.issues[0].message}`];
        }
      }
    }

    // 3. Validasi duplikasi jenis sampah
    const seenWasteTypes = new Map<string, number>();
    for (let idx = 0; idx < items.length; idx++) {
      const wtId = items[idx].wasteTypeId;
      if (!wtId) continue;
      if (seenWasteTypes.has(wtId)) {
        const firstIdx = seenWasteTypes.get(wtId)!;
        const jsName = jenisSampahList.find((j) => j.id === wtId)?.nama || "ini";
        const msg = `Jenis sampah "${jsName}" pada Item #${idx + 1} duplikat dengan Item #${firstIdx + 1}. Gabungkan beratnya atau pilih jenis sampah lain.`;
        errors[`items.${idx}.wasteTypeId`] = [msg];
        errors["items"] = [msg];
      } else {
        seenWasteTypes.set(wtId, idx);
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstMsg = Object.values(errors).flat()[0];
      setErrorMessage(firstMsg || "Harap lengkapi isian form dengan benar.");
      return;
    }

    if (!fotoFile) {
      setErrorMessage(ERROR_MESSAGES.FOTO_WAJIB);
      photoInputRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const formData = buildSetorFormData(
        {
          customerId,
          items: items.map((i) => ({ wasteTypeId: i.wasteTypeId, berat: beratBersih(i.berat) })),
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
          const firstErrorMsg = Object.values(res.fieldErrors).flat()[0];
          setErrorMessage(firstErrorMsg || res.message || ERROR_MESSAGES[res.code]);
        } else {
          setErrorMessage(res.message || ERROR_MESSAGES[res.code]);
        }
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

            {fieldErrors["items"] && (
              <p className="text-xs text-rose-400 font-medium">
                {fieldErrors["items"].join(", ")}
              </p>
            )}

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
                          className={`w-full bg-slate-900 border ${
                            fieldErrors[`items.${idx}.wasteTypeId`]
                              ? "border-rose-500 focus:border-rose-400"
                              : "border-slate-700 focus:border-emerald-500"
                          } text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none`}
                        >
                          {jenisSampahList.map((js) => (
                            <option key={js.id} value={js.id}>
                              {js.nama} — {formatRupiah(js.hargaBeli)}/kg
                            </option>
                          ))}
                        </select>
                        {fieldErrors[`items.${idx}.wasteTypeId`] && (
                          <p className="text-[11px] text-rose-400 mt-1 font-medium">
                            {fieldErrors[`items.${idx}.wasteTypeId`].join(", ")}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Berat Timbangan (kg)
                        </label>
                        <input
                          type="text"
                          placeholder="contoh: 12.50"
                          value={item.berat}
                          onChange={(e) => handleItemChange(idx, "berat", e.target.value)}
                          className={`w-full bg-slate-900 border ${
                            fieldErrors[`items.${idx}.berat`]
                              ? "border-rose-500 focus:border-rose-400"
                              : "border-slate-700 focus:border-emerald-500"
                          } text-slate-100 text-xs font-mono rounded-xl px-3 py-2.5 outline-none placeholder-slate-600`}
                        />
                        {fieldErrors[`items.${idx}.berat`] && (
                          <p className="text-[11px] text-rose-400 mt-1 font-medium">
                            {fieldErrors[`items.${idx}.berat`].join(", ")}
                          </p>
                        )}
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

              {!fotoPreview ? (
                <label
                  htmlFor="foto-input"
                  className="w-full sm:w-auto bg-slate-950 hover:bg-slate-800 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center group"
                >
                  <Camera className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 mb-2 transition-colors" />
                  <span className="text-xs font-semibold text-slate-200">Pilih Foto Timbangan</span>
                  <span className="text-[10px] text-slate-500 mt-1">JPG, PNG, atau WebP (Maks {BATAS_FOTO})</span>
                </label>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="relative w-32 h-32 rounded-2xl overflow-hidden border border-emerald-500/40 shadow-lg shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau blob: lokal dari file yang dipilih; next/image tidak cocok. */}
                    <img src={fotoPreview} alt="Pratinjau Foto" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-950/80 text-[10px] text-emerald-400 font-medium">
                      Terlampir
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleHapusFoto}
                    className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3.5 py-2.5 rounded-xl border border-rose-500/20 transition-all font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Foto</span>
                  </button>
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
