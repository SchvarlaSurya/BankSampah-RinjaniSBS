import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Wajib: izinkan upload foto timbangan hingga 2 MB per dokumen.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
