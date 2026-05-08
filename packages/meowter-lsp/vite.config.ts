/// <reference types="vitest/config" />
import { chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const shebang = (): Plugin => {
  let outDir = "dist";
  const targets = new Set<string>();
  return {
    name: "shebang",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk" && file.fileName.endsWith(".js")) {
          file.code = `#!/usr/bin/env node\n${file.code}`;
          targets.add(file.fileName);
        }
      }
    },
    async closeBundle() {
      const root = process.cwd();
      for (const name of targets) {
        await chmod(resolve(root, outDir, name), 0o755);
      }
    },
  };
};

export default defineConfig({
  plugins: [shebang()],
  build: {
    target: "node20",
    ssr: true,
    minify: false,
    lib: {
      entry: resolve(import.meta.dirname, "src/server.ts"),
      formats: ["es"],
      fileName: () => "server.js",
    },
    rollupOptions: {
      external: [
        /^node:/,
        "chokidar",
        "meowter",
        "meowter/codegen",
        "vscode-languageserver",
        "vscode-languageserver/node",
        "vscode-languageserver-textdocument",
      ],
      output: {
        entryFileNames: "server.js",
      },
    },
  },
  test: {
    environment: "node",
  },
});
