import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }],
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/db/global-setup.ts"],
    // Semua file berbagi satu DB lokal; jalankan berurutan.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 60_000,
    reporters: ["verbose"],
  },
});
