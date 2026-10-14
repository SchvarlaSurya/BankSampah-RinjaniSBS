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
import { ArrowLeft, Camera, Loader2, Plus, Scale, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";
import { HasilTransaksi } from "@/components/hasil-transaksi";

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
      <HasilTransaksi
        judul="Setor sampah tercatat"
        keterangan={
          <>
            Saldo <span className="font-medium text-ink">{nasabah?.nama}</span> sudah diperbarui.
          </>
        }
        saldoBaru={successData.saldoBaru}
        duplikat={successData.duplikat}
        aksi={
          <>
            <button
              type="button"
              onClick={() => {
                setSuccessData(null);
                clientRequestIdRef.current = crypto.randomUUID();
                setFotoFile(null);
                setFotoPreview(null);
                setItems([{ wasteTypeId: jenisSampahList[0]?.id || "", berat: "" }]);
              }}
              className={buttonClass("secondary", "lg")}
            >
              Setor lagi
            </button>
            <Link href={`/admin/nasabah/${customerId}`} className={buttonClass("primary", "lg")}>
              Kembali ke nasabah
            </Link>
          </>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/admin/nasabah/${customerId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Batal, kembali ke nasabah
      </Link>

      <PageHeader
        title="Setor sampah"
        description={
          <>
            Nasabah <span className="font-medium text-ink">{nasabah.nama}</span> ·{" "}
            <span className="tabular-nums">{nasabah.username}</span>
          </>
        }
      />

      {errorMessage && <Alert tone="danger">{errorMessage}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Barang & timbangan */}
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Scale className="size-4 text-ink-muted" aria-hidden="true" />
                Barang & berat timbangan
              </span>
            }
            actions={
              <Button type="button" variant="secondary" onClick={handleAddItem}>
                <Plus />
                Tambah jenis
              </Button>
            }
          />
          <div className="space-y-4 p-5">
            {fieldErrors["items"] && <Alert tone="danger">{fieldErrors["items"].join(", ")}</Alert>}

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
                <fieldset key={idx} className="rounded-control border border-line p-4">
                  <legend className="sr-only">Barang {idx + 1}</legend>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ink-muted">Barang {idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className={buttonClass("ghost", "icon", "text-danger-fg hover:bg-danger-bg hover:text-danger-fg")}
                        aria-label={`Hapus barang ${idx + 1}`}
                      >
                        <Trash2 />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
                    <Field
                      label="Jenis sampah"
                      htmlFor={`setor-jenis-${idx}`}
                      error={fieldErrors[`items.${idx}.wasteTypeId`]?.join(", ")}
                    >
                      <Select
                        id={`setor-jenis-${idx}`}
                        value={item.wasteTypeId}
                        onChange={(e) => handleItemChange(idx, "wasteTypeId", e.target.value)}
                        aria-invalid={fieldErrors[`items.${idx}.wasteTypeId`] ? true : undefined}
                      >
                        {jenisSampahList.map((js) => (
                          <option key={js.id} value={js.id}>
                            {js.nama} — {formatRupiah(js.hargaBeli)}/kg
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Berat (kg)" htmlFor={`setor-berat-${idx}`} error={fieldErrors[`items.${idx}.berat`]?.join(", ")}>
                      <Input
                        id={`setor-berat-${idx}`}
                        type="text"
                        inputMode="decimal"
                        placeholder="contoh: 12.50"
                        value={item.berat}
                        onChange={(e) => handleItemChange(idx, "berat", e.target.value)}
                        aria-invalid={fieldErrors[`items.${idx}.berat`] ? true : undefined}
                        className="tabular-nums"
                      />
                    </Field>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
                    <span className="text-ink-muted">Subtotal (perkiraan)</span>
                    <span className="font-semibold text-ink tabular-nums">{formatRupiah(estimasi)}</span>
                  </div>
                </fieldset>
              );
            })}

            <div className="flex items-center justify-between rounded-control bg-brand-soft px-4 py-3">
              <span className="text-sm font-medium text-ink">Total nilai setor (perkiraan)</span>
              <span className="text-xl font-semibold text-ink tabular-nums">{formatRupiah(totalEstimasi)}</span>
            </div>
            <p className="text-xs text-ink-muted">Angka final dihitung server setelah disimpan.</p>
          </div>
        </Card>

        {/* Foto timbangan */}
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Camera className="size-4 text-ink-muted" aria-hidden="true" />
                Foto timbangan <span className="text-danger-fg">*</span>
              </span>
            }
            description={`JPG, PNG, atau WebP, maksimal ${BATAS_FOTO}.`}
          />
          <div className="p-5">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="sr-only"
              id="foto-input"
            />

            {!fotoPreview ? (
              <label
                htmlFor="foto-input"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-control border-2 border-dashed border-line px-6 py-8 text-center transition-colors duration-150 hover:border-brand hover:bg-brand-soft"
              >
                <Camera className="size-6 text-ink-subtle" aria-hidden="true" />
                <span className="text-sm font-medium text-ink">Pilih foto timbangan</span>
                <span className="text-xs text-ink-muted">Ketuk untuk membuka kamera atau galeri</span>
              </label>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative size-28 shrink-0 overflow-hidden rounded-control border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau blob: lokal dari file yang dipilih; next/image tidak cocok. */}
                  <img src={fotoPreview} alt="Pratinjau foto timbangan" className="size-full object-cover" />
                </div>
                <div className="space-y-2">
                  <Badge tone="success">Foto terlampir</Badge>
                  <div>
                    <button type="button" onClick={handleHapusFoto} className={buttonClass("secondary")}>
                      <Trash2 />
                      Hapus foto
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Catatan */}
        <Card className="p-5">
          <Field label="Catatan (opsional)" htmlFor="setor-catatan">
            <Textarea
              id="setor-catatan"
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan tambahan tentang timbangan atau sampah"
            />
          </Field>
        </Card>

        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="animate-spin" />
              <span>Memproses setor…</span>
            </>
          ) : (
            <span>Simpan setor</span>
          )}
        </Button>
      </form>
    </div>
  );
}
