import { readFile } from "node:fs/promises";
import chokidar from "chokidar";
import { extractRoutesFromHtml } from "meowter/codegen";
import type { ExtractOptions } from "meowter/codegen";

export interface RouteIndexOptions {
  workspaceFolders: readonly string[];
  globs: string[];
  extract?: ExtractOptions;
}

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

  const watcher = chokidar.watch(options.globs, {
    cwd:
      options.workspaceFolders[0] !== undefined
        ? options.workspaceFolders[0]
        : process.cwd(),
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
  });

  await new Promise<void>((res) => {
    watcher.on("ready", () => {
      res();
    });
    watcher.on("add", (file) => {
      void ingest(file).then(recompute);
    });
    watcher.on("change", (file) => {
      void ingest(file).then(recompute);
    });
    watcher.on("unlink", (file) => {
      drop(file);
      recompute();
    });
  });

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
