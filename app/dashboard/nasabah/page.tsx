import React from "react";
import { CreditCard, Wallet, Recycle, History } from "lucide-react";

export default function DashboardNasabah() {
  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Salam Pengenal */}
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Halo, Nasabah Rinjani! 👋
          </h1>
          <p className="text-gray-500">
            Selamat datang di Dashboard Bank Sampah Rinjani. Pantau terus kontribusi Anda!
          </p>
        </header>

        {/* Kartu Statistik */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:scale-[1.02]">
            <div className="p-4 bg-green-100 text-green-600 rounded-xl">
              <Wallet size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Saldo Saat Ini</p>
              <h2 className="text-2xl font-bold text-gray-900">Rp 125.000</h2>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:scale-[1.02]">
            <div className="p-4 bg-blue-100 text-blue-600 rounded-xl">
              <Recycle size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Sampah Terkumpul</p>
              <h2 className="text-2xl font-bold text-gray-900">45.5 Kg</h2>
            </div>
          </div>
        </div>

        {/* Section Riwayat Transaksi */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center gap-2">
            <History className="text-gray-400" size={24} />
            <h3 className="text-xl font-semibold text-gray-900">Riwayat Setoran Terbaru</h3>
          </div>

          <div className="overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-sm text-gray-500">
                  <th className="pb-3 font-medium">Tanggal</th>
                  <th className="pb-3 font-medium">Jenis Sampah</th>
                  <th className="pb-3 font-medium text-right">Berat (Kg)</th>
                  <th className="pb-3 font-medium text-right">Saldo (Rp)</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 text-gray-600">07 Okt 2026</td>
                  <td className="py-4 font-medium text-gray-900">Kardus & Kertas</td>
                  <td className="py-4 text-right text-gray-600">5.2</td>
                  <td className="py-4 text-right font-medium text-green-600">+15.600</td>
                </tr>
                <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 text-gray-600">02 Okt 2026</td>
                  <td className="py-4 font-medium text-gray-900">Botol Plastik PET</td>
                  <td className="py-4 text-right text-gray-600">2.1</td>
                  <td className="py-4 text-right font-medium text-green-600">+8.400</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 text-gray-600">25 Sep 2026</td>
                  <td className="py-4 font-medium text-gray-900">Besi & Logam</td>
                  <td className="py-4 text-right text-gray-600">10.0</td>
                  <td className="py-4 text-right font-medium text-green-600">+45.000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
