import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

const collect = (value) => {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(collect);
  return [];
};

const paths = [...new Set(collect(pkg.publishConfig))];
const missing = paths.filter((p) => !existsSync(resolve(root, p)));

if (missing.length > 0) {
  console.error("publishConfig references files that do not exist:");
  for (const p of missing) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`check:pack ok (${paths.length} paths)`);
