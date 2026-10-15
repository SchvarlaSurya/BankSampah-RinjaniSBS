import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo SBS (public/logo-sbs.svg, vektor). viewBox sudah dipotong pas ke isi logo (513x289), jadi
 * ukurannya cukup diatur lewat lebar di className; tinggi mengikuti rasio. Latar transparan, tapi
 * tulisan "RINJANI" gelap: di atas latar gelap (sidebar) tetap pakai pelat putih.
 */
export function LogoSbs({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo-sbs.svg"
      alt="SBS Rinjani Bank Sampah"
      width={513}
      height={289}
      priority={priority}
      unoptimized
      className={cn("block h-auto", className)}
    />
  );
}
