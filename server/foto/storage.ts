import "server-only";
import { env } from "../konfigurasi";
import { fotoStorageLokal } from "./lokal";
import { fotoStorageSupabase } from "./supabase";

export interface UrlFoto {
  url: string;
  berlakuHingga: Date;
}

/** Penyimpanan foto timbangan. `path` = kunci yang disimpan di transactions.path_foto. */
export interface FotoStorage {
  simpan(path: string, data: Uint8Array, mime: string): Promise<void>;
  hapus(path: string): Promise<void>;
  urlBertandatangan(path: string, detik: number): Promise<UrlFoto>;
}

/** Umur URL foto untuk super_admin. */
export const UMUR_URL_FOTO_DETIK = 5 * 60;

let instans: FotoStorage | null = null;

/** Dipilih lewat env FOTO_STORAGE: "local" (dev/tes) atau "supabase" (produksi, BELUM TERUJI). */
export function fotoStorage(): FotoStorage {
  instans ??=
    env.FOTO_STORAGE === "supabase"
      ? fotoStorageSupabase({ url: env.SUPABASE_URL!, kunci: env.SUPABASE_SERVICE_ROLE_KEY!, bucket: env.FOTO_BUCKET })
      : fotoStorageLokal({ dir: env.FOTO_LOCAL_DIR, rahasia: env.BETTER_AUTH_SECRET });
  return instans;
}
