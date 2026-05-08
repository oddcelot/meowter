/// <reference types="vite/client" />
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { meowterRoutes } from "meowter/vite-plugin";

const PUBLIC_BASE = process.env["PUBLIC_BASE"];

const htmlBaseToken = (): Plugin => {
  let base = "/";
  return {
    name: "html-base-token",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(/\{\{BASE\}\}/g, base);
      },
    },
  };
};

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
  plugins: [htmlBaseToken(), spaFallback404(), meowterRoutes()],
});
