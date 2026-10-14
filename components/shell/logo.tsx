import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo SBS (public/logo-rinjani.png, 1280x640, latar putih). File TIDAK diubah: margin putihnya
 * hanya dipotong lewat CSS (wadah overflow-hidden seukuran isi logo: x 428-934, y 105-383),
 * tanpa peregangan atau efek. Selalu tampil di atas pelat putih karena latar file-nya putih.
 */
export function LogoSbs({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={cn("relative block aspect-[506/278] overflow-hidden", className)}>
      <Image
        src="/logo-rinjani.png"
        alt="SBS Rinjani Bank Sampah"
        width={1280}
        height={640}
        priority={priority}
        sizes="(max-width: 1024px) 160px, 200px"
        style={{ position: "absolute", width: "252.96%", maxWidth: "none", height: "auto", left: "-84.58%", top: "-37.77%" }}
      />
    </span>
  );
}
