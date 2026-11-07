import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/db/global-setup.ts"],
    // Env server/** + mock next/headers (dipakai tests/server; tidak berpengaruh ke tests/db).
    setupFiles: ["tests/server/setup.ts"],
    // Semua file berbagi satu DB lokal; jalankan berurutan.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 60_000,
    reporters: ["verbose"],
    // better-auth memuat next/headers secara dinamis dari dalam node_modules; harus di-inline
    // supaya import itu melewati vi.mock (tests/server/setup.ts), bukan modul Next asli.
    server: { deps: { inline: ["better-auth"] } },
  },
});
