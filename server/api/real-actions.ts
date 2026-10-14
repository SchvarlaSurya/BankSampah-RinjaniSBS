// Objek untuk saklar frontend (lib/api/actions.ts). Sengaja TANPA "server-only" dan tanpa
// "use server": file ini diimpor Client Component; fungsi di dalamnya adalah referensi Server
// Action dari ./actions (file "use server" hanya boleh mengekspor fungsi async).
import type { Actions } from "@/contract";
import {
  buatPengguna,
  gantiPassword,
  getLatestIdByRt,
  koreksi,
  login,
  logout,
  resetPasswordPengguna,
  sesuaikanSaldo,
  setor,
  setStatusPengguna,
  simpanJenisSampah,
  tarik,
  updateHargaSampah,
} from "./actions";

export const realActions: Actions = {
  login,
  logout,
  gantiPassword,
  buatPengguna,
  getLatestIdByRt,
  resetPasswordPengguna,
  setStatusPengguna,
  simpanJenisSampah,
  updateHargaSampah,
  setor,
  tarik,
  koreksi,
  sesuaikanSaldo,
};
