import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { glob } from "tinyglobby";
import type { Plugin } from "vite";
import { extractRoutesFromHtml, type ExtractOptions } from "./extract-routes.ts";
import { emitRouteRegistryDts } from "./emit-dts.ts";

export interface MeowterRoutesPluginOptions extends ExtractOptions {
  /**
   * Glob(s) of HTML files to scan, relative to the Vite project root.
   * @default ["index.html", "src/**\/*.html"]
   */
  include?: string | string[];

  /**
   * Path to write the generated `.d.ts`, relative to the Vite project
   * root. @default "meowter-routes.d.ts"
   */
  outFile?: string;
}

const DEFAULT_INCLUDE = ["index.html", "src/**/*.html"];
const DEFAULT_OUT_FILE = "meowter-routes.d.ts";

/**
 * Vite plugin: scans HTML files for `<meow-route>` declarations,
 * extracts their full paths, and writes a `.d.ts` that augments
 * `meowter`'s `RouteRegistry`. Re-runs on relevant file changes during
 * dev; runs once at build time.
 */
export function meowterRoutes(
  options: MeowterRoutesPluginOptions = {},
): Plugin {
  const includeGlobs = Array.isArray(options.include)
    ? options.include
    : options.include
      ? [options.include]
      : DEFAULT_INCLUDE;
  const outFileRel = options.outFile ?? DEFAULT_OUT_FILE;
  const extractOpts: ExtractOptions = {
    ...(options.basePlaceholder !== undefined
      ? { basePlaceholder: options.basePlaceholder }
      : {}),
  };

  let projectRoot = process.cwd();
  let outFileAbs = resolve(projectRoot, outFileRel);
  let lastEmitted = "";

  const generate = async (): Promise<void> => {
    const matches = await glob(includeGlobs, {
      cwd: projectRoot,
      absolute: true,
      onlyFiles: true,
    });
    const found = Array.from(new Set(matches));

    const allPaths = new Set<string>();
    for (const file of found) {
      try {
        const html = await readFile(file, "utf8");
        for (const path of extractRoutesFromHtml(html, extractOpts)) {
          allPaths.add(path);
        }
      } catch {
        // ignore unreadable files (race with vite during HMR)
      }
    }

    const dts = emitRouteRegistryDts(Array.from(allPaths));
    if (dts === lastEmitted) return;
    lastEmitted = dts;
    await writeFile(outFileAbs, dts, "utf8");
  };

  const isWatched = (file: string): boolean => {
    if (!file.endsWith(".html")) return false;
    return file.startsWith(projectRoot);
  };

  return {
    name: "meowter:routes",
    async configResolved(config) {
      projectRoot = config.root;
      outFileAbs = resolve(projectRoot, outFileRel);
      await generate();
    },
    configureServer(server) {
      const onChange = (file: string): void => {
        if (isWatched(file)) void generate();
      };
      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}
