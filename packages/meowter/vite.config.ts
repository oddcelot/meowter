/// <reference types="vitest/config" />
import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      include: ["src"],
      exclude: ["src/**/*.test.ts"],
      bundleTypes: true,
    }),
  ],
  build: {
    target: "es2022",
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "meowter",
    },
    rollupOptions: {
      external: ["@solidjs/signals"],
    },
  },
  test: {
    environment: "happy-dom",
  },
});
