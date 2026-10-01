// Objek untuk saklar frontend (src/lib/api/actions.ts). Sengaja TANPA "server-only" dan tanpa
// "use server": file ini diimpor Client Component; fungsi di dalamnya adalah referensi Server
// Action dari ./actions (file "use server" hanya boleh mengekspor fungsi async).
import type { Actions } from "@/contract";
import {
  buatPengguna,
  gantiPassword,
  koreksi,
  login,
  logout,
  resetPasswordPengguna,
  setor,
  setStatusPengguna,
  simpanJenisSampah,
  tarik,
} from "./actions";

export const realActions: Actions = {
  login,
  logout,
  gantiPassword,
  buatPengguna,
  resetPasswordPengguna,
  setStatusPengguna,
  simpanJenisSampah,
  setor,
  tarik,
  koreksi,
};
