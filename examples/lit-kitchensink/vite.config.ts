/// <reference types="vite/client" />
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { meowterRoutes } from "meowter/vite-plugin";
import { litPlugin } from "@oddsquad/vite-plugin-lit";
import { DevTools } from "@vitejs/devtools";

const PUBLIC_BASE = process.env["PUBLIC_BASE"];

const spaFallback404 = (): Plugin => {
  let outDir = "dist";
  return {
    name: "spa-fallback-404",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      const root = process.cwd();
      await copyFile(resolve(root, outDir, "index.html"), resolve(root, outDir, "404.html"));
    },
  };
};

export default defineConfig({
  base: PUBLIC_BASE ?? "/",
  plugins: [spaFallback404(), meowterRoutes(), litPlugin({ timeline: true }), DevTools()],
});
