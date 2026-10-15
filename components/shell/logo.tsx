import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo SBS (vektor, viewBox dipotong pas ke isi logo 513x289). Ukuran cukup diatur lewat lebar di
 * className; tinggi mengikuti rasio.
 * - "terang" (public/logo-sbs.svg): warna asli, untuk latar terang.
 * - "gelap" (public/logo-sbs-gelap.svg): tulisan jadi terang, latar menyatu dengan sidebar #1C211C.
 *   Hanya untuk latar sidebar (warna latar ikut tertanam di file).
 */
export function LogoSbs({
  className,
  priority = false,
  varian = "terang",
}: {
  className?: string;
  priority?: boolean;
  varian?: "terang" | "gelap";
}) {
  return (
    <Image
      src={varian === "gelap" ? "/logo-sbs-gelap.svg" : "/logo-sbs.svg"}
      alt="SBS Rinjani Bank Sampah"
      width={513}
      height={289}
      priority={priority}
      unoptimized
      className={cn("block h-auto", className)}
    />
  );
}
