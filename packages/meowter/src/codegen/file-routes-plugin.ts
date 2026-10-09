import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { glob } from "tinyglobby";
import type { Plugin } from "vite";
import { discoverFileRoutes } from "./extract-file-routes.ts";
import { emitRouteTree } from "./emit-route-tree.ts";

export interface MeowterFileRoutesPluginOptions {
  /**
   * Directory containing `*.route.ts` files, relative to the Vite project
   * root. @default "src/routes"
   */
  routesDir?: string;

  /**
   * Where to write the generated `routeTree.gen.ts`, relative to the Vite
   * project root. @default "src/routeTree.gen.ts"
   */
  outFile?: string;

  /**
   * Glob (relative to `routesDir`) matched against route files.
   * @default "**\/*.route.ts"
   */
  include?: string;

  /**
   * Override the `meowter` import specifier in the generated file. Useful
   * for tests / monorepo aliases. @default "meowter"
   */
  meowterSpecifier?: string;
}

const DEFAULT_ROUTES_DIR = "src/routes";
const DEFAULT_OUT_FILE = "src/routeTree.gen.ts";
const DEFAULT_INCLUDE = "**/*.route.ts";

/**
 * Vite plugin: scans `src/routes/**\/*.route.ts`, derives the route tree
 * from the filename convention, and writes `src/routeTree.gen.ts`. Watches
 * for add/change/unlink during dev and regenerates incrementally; emits
 * once before build.
 */
export function meowterFileRoutes(options: MeowterFileRoutesPluginOptions = {}): Plugin {
  const routesDirRel = options.routesDir ?? DEFAULT_ROUTES_DIR;
  const outFileRel = options.outFile ?? DEFAULT_OUT_FILE;
  const include = options.include ?? DEFAULT_INCLUDE;
  const meowterSpecifier = options.meowterSpecifier;

  let projectRoot = process.cwd();
  let routesDirAbs = resolve(projectRoot, routesDirRel);
  let outFileAbs = resolve(projectRoot, outFileRel);
  let lastEmitted = "";

  const generate = async (): Promise<void> => {
    let matches: string[];
    try {
      matches = await glob(include, {
        cwd: routesDirAbs,
        absolute: false,
        onlyFiles: true,
      });
    } catch {
      // routesDir may not exist yet on a fresh install
      return;
    }

    const relPaths = matches.map((m) => m).sort();

    let src: string;
    try {
      const routes = discoverFileRoutes(
        relPaths,
        `./${relative(resolve(outFileAbs, ".."), routesDirAbs).replaceAll("\\", "/")}`,
      );
      src = emitRouteTree(routes, meowterSpecifier ? { meowterSpecifier } : {});
    } catch (error) {
      // Surface generation errors as Vite warnings so the user sees them
      // without crashing the dev server.
      console.warn(`[meowter:file-routes] ${(error as Error).message}`);
      return;
    }

    if (src === lastEmitted) return;
    lastEmitted = src;
    await writeFile(outFileAbs, src, "utf8");
  };

  const isWatched = (file: string): boolean => {
    // Avoid watching the generated file itself.
    if (file === outFileAbs) return false;
    if (!file.endsWith(".route.ts")) return false;
    return file.startsWith(routesDirAbs);
  };

  return {
    name: "meowter:file-routes",
    async configResolved(config) {
      projectRoot = config.root;
      routesDirAbs = resolve(projectRoot, routesDirRel);
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
