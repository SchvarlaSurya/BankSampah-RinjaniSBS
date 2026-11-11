"use client";

import { useState } from "react";
import { urlFotoProfil } from "@/contract";
import { cn } from "@/lib/utils";

/** Inisial dari nama: dua kata pertama ("Sri Rahayu" -> "SR"), satu kata -> satu huruf. */
export function inisialNama(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean);
  const huruf = kata.slice(0, 2).map((k) => k.charAt(0).toUpperCase());
  return huruf.join("") || "?";
}

const UKURAN = {
  sm: "size-9 text-sm",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-28 text-3xl",
} as const;

/**
 * Foto profil bundar; tanpa foto (atau foto gagal dimuat) = lingkaran inisial nama.
 * `src` langsung (pratinjau lokal) mengalahkan userId + fotoVersi.
 */
export function Avatar({
  nama,
  userId,
  fotoVersi,
  src,
  ukuran = "md",
  className,
}: {
  nama: string;
  userId?: string;
  fotoVersi?: string | null;
  src?: string | null;
  ukuran?: keyof typeof UKURAN;
  className?: string;
}) {
  const url = src ?? (userId ? urlFotoProfil(userId, fotoVersi ?? null) : null);
  const [gagal, setGagal] = useState<string | null>(null);
  const tampilFoto = url !== null && gagal !== url;

  return (
    <span
      role="img"
      aria-label={nama}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted font-semibold text-ink ring-1 ring-line ring-inset select-none",
        UKURAN[ukuran],
        className,
      )}
    >
      {tampilFoto ? (
        // next/image tidak dipakai: route foto memerlukan cookie sesi dan tidak boleh di-cache optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" onError={() => setGagal(url)} />
      ) : (
        <span aria-hidden="true">{inisialNama(nama)}</span>
      )}
    </span>
  );
}
