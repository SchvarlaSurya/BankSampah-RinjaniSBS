import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

// Dua keluarga font saja: Inter (UI & isi) dan Barlow Condensed (judul halaman publik,
// senada dengan wordmark logo). Barlow Condensed tidak dipakai di tabel/form.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SBS Rinjani | Bank Sampah",
  description: "Layanan Bank Sampah Rinjani SBS",
};

export const viewport: Viewport = {
  themeColor: "#f5f6f3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} ${barlowCondensed.variable}`}>
      <body className="flex min-h-screen flex-col overflow-x-hidden">{children}</body>
    </html>
  );
}
