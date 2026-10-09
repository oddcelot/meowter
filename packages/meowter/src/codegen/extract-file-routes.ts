/**
 * Filename → route tree translation for file-based routing.
 *
 * Convention (TanStack Router style, adapted for meowter's path syntax):
 *
 *   __root.route.ts        →  the root route (path "/")
 *   index.route.ts         →  index under root (path "")
 *   about.route.ts         →  "/about"
 *   cats.route.ts          →  "/cats" (a parent for nested children if they exist)
 *   cats.index.route.ts    →  index under "/cats"
 *   cats.new.route.ts      →  "/cats/new"
 *   cats.$id.route.ts      →  "/cats/:id"
 *   $.route.ts             →  "/*" (catch-all at root)
 *   cats.$.route.ts        →  "/cats/*"
 *
 * Each `.` in the filename is a path separator. `$name` becomes `:name`,
 * bare `$` becomes `*`, `index` becomes the empty segment (the parent path
 * owns the URL).
 */

export interface DiscoveredRoute {
  /** Path relative to the routes directory, e.g. `cats.$id.route.ts`. */
  readonly filePath: string;
  /**
   * Module specifier to use in the generated `routeTree.gen.ts` imports,
   * e.g. `./routes/cats.$id.route.ts`.
   */
  readonly importPath: string;
  /** PascalCase identifier in the generated file, e.g. `CatsIdRoute`. */
  readonly exportName: string;
  /** Filename key without the `.route.ts` suffix, e.g. `cats.$id`. */
  readonly key: string;
  /** Resolved full path, e.g. `/cats/:id`. */
  readonly fullPath: string;
  /** Segment passed to `bindFileRoute(parent, ownPath)`. */
  readonly ownPath: string;
  /** `key` of the parent route, or `null` for the root. */
  readonly parentKey: string | null;
  readonly isRoot: boolean;
  readonly isIndex: boolean;
  readonly isCatchAll: boolean;
}

const ROUTE_SUFFIX = ".route.ts";
const ROOT_KEY = "__root";

function translateSegment(seg: string): string {
  if (seg === "$") return "*";
  if (seg.startsWith("$")) return ":" + seg.slice(1);
  if (seg === "index") return "";
  return seg;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function partToIdent(part: string): string {
  if (part === "$") return "Splat";
  if (part.startsWith("$")) return capitalize(part.slice(1));
  if (part === "index") return "Index";
  return capitalize(part);
}

function keyToExportName(key: string): string {
  if (key === ROOT_KEY) return "RootRoute";
  const parts = key.split(".");
  return parts.map(partToIdent).join("") + "Route";
}

function keyToFullPath(key: string): string {
  const parts = key.split(".");
  const translated = parts.map(translateSegment).filter((p) => p !== "");
  if (translated.length === 0) return "/";
  if (translated.every((p) => p === "*")) return "/*";
  // catch-all gets a special join
  return "/" + translated.join("/");
}

/**
 * Compute the segment passed to `bindFileRoute`. Mirrors the hand-written
 * routes.ts style: top-level routes pass `cats`, nested routes pass the
 * last filename segment (translated), index routes pass `""`, catch-alls
 * pass `"*"`.
 */
function keyToOwnPath(key: string, parentKey: string | null): string {
  if (key === ROOT_KEY) return "/";
  const parts = key.split(".");
  if (parentKey === null || parentKey === ROOT_KEY) {
    // Top-level under root: full filename (translated, dots → slashes)
    const translated = parts.map(translateSegment).filter((p) => p !== "");
    if (translated.length === 0) return "";
    return translated.join("/");
  }
  // Nested: just the last segment, translated
  const last = parts[parts.length - 1]!;
  return translateSegment(last);
}

/** Find the longest dotted prefix of `key` that exists in `allKeys`. */
function findParentKey(key: string, allKeys: Set<string>): string | null {
  const parts = key.split(".");
  for (let i = parts.length - 1; i >= 1; i--) {
    const prefix = parts.slice(0, i).join(".");
    if (allKeys.has(prefix)) return prefix;
  }
  return allKeys.has(ROOT_KEY) ? ROOT_KEY : null;
}

/**
 * Convert a list of route filenames (relative to the routes directory) into
 * a sorted, fully-resolved `DiscoveredRoute[]`. Throws if two files resolve
 * to the same path.
 */
export function discoverFileRoutes(
  files: readonly string[],
  importDirRelative = "./routes",
): DiscoveredRoute[] {
  const keys = new Set<string>();
  const entries: Array<{ file: string; key: string }> = [];

  for (const file of files) {
    if (!file.endsWith(ROUTE_SUFFIX)) continue;
    const key = file.slice(0, -ROUTE_SUFFIX.length);
    if (!key) continue;
    if (keys.has(key)) {
      throw new Error(`meowter: duplicate route file key "${key}"`);
    }
    keys.add(key);
    entries.push({ file, key });
  }

  const seenPaths = new Map<string, string>();
  const routes: DiscoveredRoute[] = [];

  for (const { file, key } of entries) {
    const isRoot = key === ROOT_KEY;
    const parts = key.split(".");
    const lastTranslated = translateSegment(parts[parts.length - 1]!);
    const isIndex = !isRoot && lastTranslated === "";
    const isCatchAll = !isRoot && lastTranslated === "*";
    const fullPath = isRoot ? "/" : keyToFullPath(key);
    const parentKey = isRoot ? null : findParentKey(key, keys);
    const ownPath = keyToOwnPath(key, parentKey);
    const exportName = keyToExportName(key);
    const importPath = `${importDirRelative}/${file}`;

    // Indexes share their parent's fullPath by design (e.g. `cats.route.ts`
    // + `cats.index.route.ts` both /cats). Only flag two non-index routes
    // collapsing onto the same path.
    if (!isRoot && !isIndex) {
      const dupeOf = seenPaths.get(fullPath);
      if (dupeOf !== undefined) {
        throw new Error(`meowter: routes "${dupeOf}" and "${file}" both resolve to "${fullPath}"`);
      }
      seenPaths.set(fullPath, file);
    }

    routes.push({
      filePath: file,
      importPath,
      exportName,
      key,
      fullPath,
      ownPath,
      parentKey,
      isRoot,
      isIndex,
      isCatchAll,
    });
  }

  // Sort:
  //  1. root first
  //  2. parents before children (by depth)
  //  3. within a depth: literal segments first, then dynamic (`:param`),
  //     then catch-all (`*`). This guarantees `path-select` checks more
  //     specific routes before fallback ones (e.g. `/cats/new` matches the
  //     literal before `/cats/:id`).
  //  4. within same specificity: alphabetical for stable output
  const specificity = (r: DiscoveredRoute): number => {
    if (r.isCatchAll) return 2;
    if (r.ownPath.startsWith(":")) return 1;
    return 0;
  };
  routes.sort((a, b) => {
    if (a.isRoot && !b.isRoot) return -1;
    if (b.isRoot && !a.isRoot) return 1;
    const depthDiff = a.key.split(".").length - b.key.split(".").length;
    if (depthDiff !== 0) return depthDiff;
    const specDiff = specificity(a) - specificity(b);
    if (specDiff !== 0) return specDiff;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  return routes;
}

/** Group children under their parent key for tree composition in the gen file. */
export function groupByParent(
  routes: readonly DiscoveredRoute[],
): Map<string, readonly DiscoveredRoute[]> {
  const groups = new Map<string, DiscoveredRoute[]>();
  for (const r of routes) {
    if (r.parentKey === null) continue;
    const arr = groups.get(r.parentKey) ?? [];
    arr.push(r);
    groups.set(r.parentKey, arr);
  }
  return groups;
}
