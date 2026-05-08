/// <reference types="vite/client" />
import { defineConfig, type Plugin } from "vite";

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

export default defineConfig({
  base: PUBLIC_BASE ?? "/",
  plugins: [htmlBaseToken()],
});
