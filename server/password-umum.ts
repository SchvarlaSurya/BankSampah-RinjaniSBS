import "server-only";
/**
 * Penolakan password yang mudah ditebak saat ganti password. Daftar sengaja kecil dan lokal
 * (tidak memanggil layanan luar): password paling umum secara global + pola lokal Indonesia.
 * Dicek setelah dinormalkan ke huruf kecil.
 */
const DAFTAR = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "p@ssw0rd", "p@ssword",
  "12345678", "123456789", "1234567890", "0123456789", "87654321", "98765432", "11111111",
  "00000000", "12341234", "12121212", "11223344", "123123123", "1q2w3e4r", "1qaz2wsx",
  "qwertyui", "qwerty12", "qwerty123", "qwertyuiop", "asdfghjk", "asdfasdf", "zxcvbnm1",
  "abcd1234", "abc12345", "abcdefgh", "aaaaaaaa", "iloveyou", "letmein1", "welcome1",
  "admin123", "admin1234", "administrator", "superadmin", "rahasia1", "rahasia123",
  "bismillah", "bismillah1", "bismillah123", "alhamdulillah", "indonesia", "indonesia1",
  "indonesia123", "jakarta1", "jakarta123", "sayangku", "sayang123", "cintaku1",
  "banksampah", "banksampah1", "banksampah123", "sampah123", "nasabah1", "nasabah123",
  "rinjani1", "rinjani123", "lombok123", "merdeka45", "merdeka1945", "garuda123",
]);

/** Pesan untuk fieldErrors.passwordBaru, atau null bila boleh dipakai. */
export function alasanPasswordLemah(password: string, username: string): string | null {
  const p = password.toLowerCase();
  if (DAFTAR.has(p)) return "Password terlalu umum, pilih yang lain";
  if (/^(.)\1+$/.test(p)) return "Password tidak boleh satu karakter berulang";
  if ("01234567890123456789".includes(p) || "98765432109876543210".includes(p)) {
    return "Password tidak boleh angka berurutan";
  }
  if (username && p.includes(username.toLowerCase())) return "Password tidak boleh memuat ID pengguna";
  return null;
}
