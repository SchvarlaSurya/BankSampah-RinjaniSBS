import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    // Next 16 mencetak argumen Server Action di log dev, termasuk password login & ganti
    // password apa adanya. Dimatikan supaya kredensial tidak masuk terminal/log.
    serverFunctions: false,
  },
  experimental: {
    serverActions: {
      // Wajib: izinkan upload foto timbangan hingga 2 MB per dokumen.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
