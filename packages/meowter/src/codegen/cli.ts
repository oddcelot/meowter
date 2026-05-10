#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { glob } from "tinyglobby";
import { extractRoutesFromHtml } from "./extract-routes.ts";
import { emitRouteRegistryDts } from "./emit-dts.ts";

interface CliOptions {
  cwd: string;
  include: string[];
  outFile: string;
  basePlaceholder?: string | undefined;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const opts: CliOptions = {
    cwd: process.cwd(),
    include: ["index.html", "src/**/*.html", "examples/**/index.html"],
    outFile: "meowter-routes.d.ts",
    basePlaceholder: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--cwd") opts.cwd = argv[++i] ?? opts.cwd;
    else if (a === "--include") opts.include = (argv[++i] ?? "").split(",").filter(Boolean);
    else if (a === "--out") opts.outFile = argv[++i] ?? opts.outFile;
    else if (a === "--base-placeholder") opts.basePlaceholder = argv[++i];
    else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else if (a !== "generate") {
      console.error(`meowter-routes: unknown argument "${a}"`);
      printHelp();
      process.exit(2);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`meowter-routes generate [options]

Scans HTML for <meow-route> declarations and writes a .d.ts that
augments the meowter package's RouteRegistry interface.

Options:
  --cwd <path>              project root (default: cwd)
  --include <globs>         comma-separated globs to scan
                            (default: index.html,src/**/*.html,examples/**/index.html)
  --out <path>              output .d.ts (default: meowter-routes.d.ts)
  --base-placeholder <str>  literal stripped from path attributes (default: {{BASE}})
  -h, --help                show this help`);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const matches = await glob(opts.include, {
    cwd: opts.cwd,
    absolute: true,
    onlyFiles: true,
  });

  const allPaths = new Set<string>();
  for (const file of matches) {
    const html = await readFile(file, "utf8");
    for (const path of extractRoutesFromHtml(
      html,
      opts.basePlaceholder !== undefined
        ? { basePlaceholder: opts.basePlaceholder }
        : {},
    )) {
      allPaths.add(path);
    }
  }

  const dts = emitRouteRegistryDts(Array.from(allPaths));
  const out = resolve(opts.cwd, opts.outFile);
  await writeFile(out, dts, "utf8");
  console.log(
    `meowter-routes: wrote ${allPaths.size} route(s) to ${opts.outFile}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
