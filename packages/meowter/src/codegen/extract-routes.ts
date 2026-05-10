import { parse, type HTMLElement } from "node-html-parser";

export interface ExtractOptions {
  /**
   * Placeholder substring stripped from `path` attributes before
   * composition. Defaults to `{{BASE}}` so kitchen-sink-style
   * `<meow-route path="{{BASE}}cats">` extracts as `/cats`.
   */
  basePlaceholder?: string;
}

const DEFAULT_BASE_PLACEHOLDER = "{{BASE}}";

/**
 * Walk an HTML source string and return the full path of every
 * `<meow-route>` declaration, composing nested paths against ancestor
 * routes the same way the runtime path compiler does.
 *
 * Indexes are emitted as their parent's full path. Catch-alls (`*`) are
 * emitted verbatim. Missing `path` attributes are skipped.
 */
export function extractRoutesFromHtml(
  html: string,
  options: ExtractOptions = {},
): string[] {
  const placeholder = options.basePlaceholder ?? DEFAULT_BASE_PLACEHOLDER;
  const root = parse(html);
  const out: string[] = [];

  const walk = (node: HTMLElement, parentFull: string | null): void => {
    const isRoute = node.tagName?.toLowerCase() === "meow-route";
    let ownFull = parentFull;

    if (isRoute) {
      const raw = node.getAttribute("path");
      if (raw === undefined) {
        // missing path attribute — skip but still descend
      } else {
        const stripped = stripPlaceholder(raw, placeholder);
        ownFull = composePath(parentFull, stripped);
        if (ownFull !== null) out.push(ownFull);
      }
    }

    for (const child of node.childNodes) {
      if (isHTMLElement(child)) walk(child, ownFull);
    }
  };

  walk(root as unknown as HTMLElement, null);
  return Array.from(new Set(out)).sort(comparePaths);
}

function isHTMLElement(node: unknown): node is HTMLElement {
  return (
    typeof node === "object" &&
    node !== null &&
    "tagName" in node &&
    "childNodes" in node
  );
}

function stripPlaceholder(raw: string, placeholder: string): string {
  if (placeholder === "") return raw;
  return raw.split(placeholder).join("");
}

function composePath(parent: string | null, raw: string): string | null {
  // catch-all stays verbatim
  if (raw === "*") return "*";

  // index — emit parent's full path (or "/" at top level)
  if (raw === "") return parent ?? "/";

  // child paths are relative to parent unless they already start with "/"
  if (raw.startsWith("/")) {
    return normalize(raw);
  }

  if (parent === null || parent === "*") {
    return normalize("/" + raw);
  }

  // join parent + child, ensuring a single slash between
  const left = parent === "/" ? "" : parent.replace(/\/+$/, "");
  const right = raw.replace(/^\/+/, "");
  return normalize(`${left}/${right}`);
}

function normalize(p: string): string {
  // collapse duplicate slashes, drop trailing slash (except root)
  let out = p.replace(/\/{2,}/g, "/");
  if (out.length > 1) out = out.replace(/\/$/, "");
  return out;
}

function comparePaths(a: string, b: string): number {
  // catch-all sorts last so editor completions show concrete paths first
  if (a === "*") return 1;
  if (b === "*") return -1;
  return a.localeCompare(b);
}
