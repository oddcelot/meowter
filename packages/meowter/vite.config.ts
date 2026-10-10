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
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        codegen: resolve(import.meta.dirname, "src/codegen/index.ts"),
        "vite-plugin": resolve(import.meta.dirname, "src/codegen/vite-plugin.ts"),
        cli: resolve(import.meta.dirname, "src/codegen/cli.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        entryFileNames: (chunk) => (chunk.name === "index" ? "meowter.js" : "[name].js"),
      },
      external: [/^node:/, "@solidjs/signals", "vite", "tinyglobby", "node-html-parser"],
    },
  },
  test: {
    environment: "happy-dom",
    typecheck: {
      enabled: true,
      include: ["src/**/*.test-d.ts"],
    },
  },
});
