/**
 * lib/api/actions.ts
 *
 * SAKLAR — ACTIONS
 * ================
 * Pilih SATU baris import di bawah. Halaman UI tidak berubah.
 *
 * MOCK → import { mockActions as a } from "./mock/actions";
 * ASLI → import { realActions as a } from "@/server/api/real-actions";
 *
 * Isi objek = referensi Server Action (fungsi dari file "use server"), jadi aman diimpor
 * Client Component. Jangan arahkan ke "@/server/api/actions": file "use server" hanya
 * boleh mengekspor fungsi async, bukan objek.
 */

// import { mockActions as a } from "./mock/actions"; // ← MOCK
import { realActions as a } from "@/server/api/real-actions"; // ← ASLI (aktif)

export const actions = a;
