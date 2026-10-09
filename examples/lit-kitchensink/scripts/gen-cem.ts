/**
 * Build a local custom-elements.json by overlaying meowter's manifest with
 * this app's registered route paths on the `<meow-link to>` attribute.
 *
 * Imports the live route tree (so paths stay in sync with code) and walks it
 * to collect every `fullPath`. Then patches the `to` attribute's `values`
 * enum + a string-literal `type.text` union so the CEM LSP suggests the real
 * registered paths inside Lit templates and HTML.
 *
 * Run via `pnpm cem:routes` — auto-runs before `pnpm dev`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "http://localhost/" });

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");
const MEOWTER_MANIFEST = resolve(REPO_ROOT, "packages/meowter/custom-elements.json");
const OUTPUT = resolve(HERE, "..", "custom-elements.json");

// dynamic import so the DOM polyfill is in place first
const { routeTree } = await import("../src/routes.ts");

interface RouteNode {
  readonly fullPath: string;
  readonly children: readonly RouteNode[];
}

function collect(route: RouteNode, into: Set<string>): void {
  into.add(route.fullPath);
  for (const child of route.children) collect(child, into);
}

const paths = new Set<string>();
collect(routeTree, paths);
const sorted = [...paths].sort();

const manifest = JSON.parse(readFileSync(MEOWTER_MANIFEST, "utf8")) as {
  modules: Array<{
    declarations: Array<{
      name?: string;
      tagName?: string;
      attributes?: Array<{
        name: string;
        type?: { text: string };
        values?: Array<{ name: string }>;
      }>;
    }>;
  }>;
};

let patched = false;
for (const mod of manifest.modules) {
  for (const decl of mod.declarations) {
    if (decl.name !== "MeowLink") continue;
    const to = decl.attributes?.find((a) => a.name === "to");
    if (!to) continue;
    to.type = { text: sorted.map((p) => `"${p}"`).join(" | ") };
    to.values = sorted.map((name) => ({ name }));
    patched = true;
  }
}

if (!patched) {
  console.error("gen-cem: could not find MeowLink declaration to patch");
  process.exit(1);
}

writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2) + "\n");
console.log(`gen-cem: wrote ${OUTPUT} with ${sorted.length} paths`);
console.log(`         ${sorted.join(", ")}`);

await GlobalRegistrator.unregister();
