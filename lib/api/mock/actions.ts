/**
 * lib/api/mock/actions.ts
 *
 * Objek MOCK untuk saklar lib/api/actions.ts. Sama seperti server/api/real-actions.ts:
 * TANPA "server-only" dan tanpa "use server" — isinya referensi Server Action dari
 * ./server-actions, jadi aman diimpor Client Component.
 * Jangan diimpor langsung dari halaman UI — lewat saklar lib/api/actions.ts.
 */

import type { Actions } from "@/contract";
import {
  buatPengguna,
  gantiPassword,
  getLatestIdByRt,
  koreksi,
  login,
  logout,
  resetPasswordPengguna,
  setor,
  setStatusPengguna,
  simpanJenisSampah,
  tarik,
  updateHargaSampah,
} from "./server-actions";

export const mockActions: Actions = {
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
};
