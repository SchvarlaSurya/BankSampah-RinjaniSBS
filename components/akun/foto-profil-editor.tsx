"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Save, Trash2 } from "lucide-react";
import { AVATAR, buildFotoProfilFormData, ERROR_MESSAGES, pesanFotoTerlaluBesar } from "@/contract";
import { actions } from "@/lib/api/actions";
import { Avatar } from "@/components/avatar";
import { Button, buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

/**
 * Kecilkan foto (sering 3-8 MB dari HP) jadi persegi AVATAR.TARGET_DIMENSI sebelum diunggah,
 * supaya pengguna awam tidak ditolak. Orientasi kamera diterapkan. Hasil WebP (JPEG bila browser
 * tidak bisa WebP); kualitas diturunkan bertahap bila masih di atas batas.
 */
async function kecilkanFoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const sisi = Math.min(bitmap.width, bitmap.height);
    const target = Math.min(AVATAR.TARGET_DIMENSI, sisi);
    const kanvas = document.createElement("canvas");
    kanvas.width = target;
    kanvas.height = target;
    const ctx = kanvas.getContext("2d");
    if (!ctx) throw new Error("canvas tidak tersedia");
    // Potong tengah jadi persegi (foto profil tampil bundar).
    ctx.drawImage(bitmap, (bitmap.width - sisi) / 2, (bitmap.height - sisi) / 2, sisi, sisi, 0, 0, target, target);

    let hasil: Blob | null = null;
    for (const kualitas of [0.85, 0.7, 0.55, 0.4]) {
      hasil = await new Promise<Blob | null>((r) => kanvas.toBlob(r, "image/webp", kualitas));
      if (hasil && hasil.type !== "image/webp") {
        hasil = await new Promise<Blob | null>((r) => kanvas.toBlob(r, "image/jpeg", kualitas));
      }
      if (hasil && hasil.size <= AVATAR.MAKS_BYTES) break;
    }
    if (!hasil) throw new Error("gagal mengompres");
    return hasil;
  } finally {
    bitmap.close();
  }
}

/**
 * Ganti / hapus foto profil. `targetUserId` diisi hanya untuk moderasi super_admin (akun orang
 * lain); kosong = akun sendiri. Pilihan file memakai accept="image/*" (HP: kamera atau galeri).
 */
export function FotoProfilEditor({
  userId,
  nama,
  fotoVersi,
  targetUserId,
  ringkas = false,
}: {
  userId: string;
  nama: string;
  fotoVersi: string | null;
  targetUserId?: string;
  /** true = tampilan di panel Kelola akun (avatar lebih kecil). */
  ringkas?: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [versi, setVersi] = useState(fotoVersi);
  const [pratinjau, setPratinjau] = useState<{ blob: Blob; url: string } | null>(null);
  const [memproses, setMemproses] = useState<"kompres" | "simpan" | "hapus" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);

  // Bersihkan object URL pratinjau.
  useEffect(() => () => {
    if (pratinjau) URL.revokeObjectURL(pratinjau.url);
  }, [pratinjau]);

  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setSukses(null);
    if (!file.type.startsWith("image/")) {
      setError("Pilih file gambar (JPG, PNG, atau WebP).");
      return;
    }
    setMemproses("kompres");
    try {
      const blob = await kecilkanFoto(file);
      if (blob.size > AVATAR.MAKS_BYTES) {
        setError(pesanFotoTerlaluBesar(blob.size));
        return;
      }
      setPratinjau({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError("Foto tidak bisa dibaca. Gunakan foto JPG, PNG, atau WebP.");
    } finally {
      setMemproses(null);
    }
  }

  async function simpan() {
    if (!pratinjau || memproses) return;
    setMemproses("simpan");
    setError(null);
    try {
      const nama = pratinjau.blob.type === "image/jpeg" ? "foto.jpg" : "foto.webp";
      const file = new File([pratinjau.blob], nama, { type: pratinjau.blob.type });
      const res = await actions.unggahFotoProfil(buildFotoProfilFormData(file, targetUserId));
      if (!res.ok) {
        const pesanField = res.fieldErrors?.foto?.[0];
        const tunggu = res.retryAfterDetik ? ` Coba lagi dalam ${Math.ceil(res.retryAfterDetik / 60)} menit.` : "";
        setError(
          res.code === "TERLALU_BANYAK_PERCOBAAN"
            ? `Foto sudah diganti ${AVATAR.MAKS_UNGGAH_PER_JAM} kali dalam satu jam.${tunggu}`
            : res.code === "FOTO_TERLALU_BESAR"
              ? pesanFotoTerlaluBesar(file.size)
              : pesanField || res.message || ERROR_MESSAGES[res.code],
        );
        return;
      }
      setVersi(res.data.fotoVersi);
      setPratinjau(null);
      setSukses("Foto profil tersimpan.");
      router.refresh();
    } catch {
      setError(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setMemproses(null);
    }
  }

  async function hapus() {
    if (memproses) return;
    setMemproses("hapus");
    setError(null);
    setSukses(null);
    try {
      const res = await actions.hapusFotoProfil(targetUserId ? { userId: targetUserId } : undefined);
      if (!res.ok) {
        setError(res.message || ERROR_MESSAGES[res.code]);
        return;
      }
      setVersi(null);
      setPratinjau(null);
      setSukses("Foto dihapus. Sekarang tampil inisial nama.");
      router.refresh();
    } catch {
      setError(ERROR_MESSAGES.SERVER_ERROR);
    } finally {
      setMemproses(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
        <Avatar
          nama={nama}
          userId={userId}
          fotoVersi={versi}
          src={pratinjau?.url ?? null}
          ukuran={ringkas ? "lg" : "xl"}
          className={pratinjau ? "ring-2 ring-brand" : undefined}
        />
        <div className="space-y-1 text-center sm:text-left">
          <p className="text-base text-ink">{pratinjau ? "Pratinjau foto baru" : versi ? "Foto profil saat ini" : "Belum ada foto"}</p>
          <p className="text-base text-ink-muted">
            JPG, PNG, atau WebP. Maksimal {AVATAR.MAKS_KB} KB. Foto dari HP otomatis dikecilkan.
          </p>
        </div>
      </div>

      <input ref={inputRef} id={`${id}-foto`} type="file" accept="image/*" className="sr-only" onChange={pilih} tabIndex={-1} />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {pratinjau ? (
          <>
            <Button size="lg" onClick={simpan} disabled={memproses !== null} className="w-full sm:w-auto">
              {memproses === "simpan" ? <Loader2 className="animate-spin" /> : <Save />}
              <span>{memproses === "simpan" ? "Menyimpan…" : "Simpan foto"}</span>
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setPratinjau(null)} disabled={memproses !== null} className="w-full sm:w-auto">
              Batal
            </Button>
          </>
        ) : (
          <label
            htmlFor={`${id}-foto`}
            className={buttonClass("secondary", "lg", "w-full cursor-pointer sm:w-auto")}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            {memproses === "kompres" ? <Loader2 className="animate-spin" /> : <Camera />}
            <span>{memproses === "kompres" ? "Menyiapkan foto…" : versi ? "Ganti foto" : "Pilih foto"}</span>
          </label>
        )}
        {versi && !pratinjau && (
          <Button variant="secondary" size="lg" onClick={hapus} disabled={memproses !== null} className="w-full sm:w-auto">
            {memproses === "hapus" ? <Loader2 className="animate-spin" /> : <Trash2 />}
            <span>Hapus foto</span>
          </Button>
        )}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {sukses && <Alert tone="success">{sukses}</Alert>}
    </div>
  );
}
