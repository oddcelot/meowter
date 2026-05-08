import { readFile } from "node:fs/promises";
import chokidar from "chokidar";
import { extractRoutesFromHtml } from "meowter/codegen";
import type { ExtractOptions } from "meowter/codegen";

export interface RouteIndexOptions {
  workspaceFolders: readonly string[];
  /**
   * Path patterns ignored during scanning. Matched against the absolute
   * path with `String.prototype.includes` (substring match). Defaults
   * cover `node_modules` and build outputs.
   */
  ignore?: readonly string[];
  extract?: ExtractOptions;
}

const DEFAULT_IGNORE = [
  "/node_modules/",
  "/dist/",
  "/.git/",
  "/.cache/",
  "/.zed/",
];

export interface RouteIndex {
  paths(): readonly string[];
  onChange(listener: () => void): () => void;
  dispose(): Promise<void>;
}

export async function createRouteIndex(
  options: RouteIndexOptions,
): Promise<RouteIndex> {
  const perFile = new Map<string, Set<string>>();
  const listeners = new Set<() => void>();
  let snapshot: readonly string[] = [];

  const recompute = (): void => {
    const all = new Set<string>();
    for (const set of perFile.values()) {
      for (const path of set) all.add(path);
    }
    const next = Array.from(all).sort(comparePaths);
    if (
      next.length === snapshot.length &&
      next.every((v, i) => v === snapshot[i])
    ) {
      return;
    }
    snapshot = next;
    for (const fn of listeners) fn();
  };

  const ingest = async (file: string): Promise<void> => {
    try {
      const html = await readFile(file, "utf8");
      const found = extractRoutesFromHtml(html, options.extract);
      perFile.set(file, new Set(found));
    } catch {
      perFile.delete(file);
    }
  };

  const drop = (file: string): void => {
    perFile.delete(file);
  };

  const ignore = [...DEFAULT_IGNORE, ...(options.ignore ?? [])];
  const isIgnored = (path: string): boolean =>
    ignore.some((pattern) => path.includes(pattern));
  const isHtml = (path: string): boolean =>
    path.endsWith(".html") || path.endsWith(".htm");

  const watchTargets = options.workspaceFolders.length
    ? Array.from(options.workspaceFolders)
    : [process.cwd()];

  const watcher = chokidar.watch(watchTargets, {
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    ignored: (path) => isIgnored(path),
  });

  const pendingInitial: Array<Promise<void>> = [];
  let ready = false;

  await new Promise<void>((res) => {
    watcher.on("ready", () => {
      ready = true;
      res();
    });
    watcher.on("add", (file) => {
      if (!isHtml(file)) return;
      const job = ingest(file).then(() => {
        if (ready) recompute();
      });
      if (!ready) pendingInitial.push(job);
    });
    watcher.on("change", (file) => {
      if (!isHtml(file)) return;
      void ingest(file).then(recompute);
    });
    watcher.on("unlink", (file) => {
      if (!isHtml(file)) return;
      drop(file);
      recompute();
    });
  });

  await Promise.all(pendingInitial);
  recompute();

  return {
    paths: () => snapshot,
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async dispose() {
      listeners.clear();
      await watcher.close();
    },
  };
}

function comparePaths(a: string, b: string): number {
  if (a === "*") return 1;
  if (b === "*") return -1;
  return a.localeCompare(b);
}
