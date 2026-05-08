/// <reference types="vitest/config" />
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const kitchensinkSpaFallback = (): Plugin => ({
  name: "kitchensink-spa-fallback",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url ?? "";
      if (
        url.startsWith("/examples/kitchensink/") &&
        !url.match(/\.[a-z0-9]+(\?|$)/i)
      ) {
        req.url = "/examples/kitchensink/index.html";
      }
      next();
    });
  },
});

export default defineConfig({
  plugins: [kitchensinkSpaFallback()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        kitchensink: resolve(
          import.meta.dirname,
          "examples/kitchensink/index.html",
        ),
      },
    },
  },
  test: {
    environment: "happy-dom",
  },
});
