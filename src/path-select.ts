import type { CompiledPath } from "./path-compile.ts";
import { extractParams } from "./path-compile.ts";

export interface RouteCandidate {
  compiledPath: CompiledPath;
  hasNestedOutlet: boolean;
}

export interface SelectResult<T extends RouteCandidate> {
  route: T;
  consumed: string;
  params: Record<string, string>;
}

export function selectFor<T extends RouteCandidate>(
  rawInput: string,
  routes: T[],
): SelectResult<T> | null {
  const input = rawInput === "" ? "/" : rawInput;
  let fallback: T | null = null;

  for (const route of routes) {
    const cp = route.compiledPath;

    if (cp.isCatchAll) {
      if (!fallback) fallback = route;
      continue;
    }

    if (cp.isIndex) {
      if (input === "/" || input === "") {
        return { route, consumed: input, params: {} };
      }
      continue;
    }

    const exactMatch = cp.exact.exec(input);
    if (exactMatch) {
      return { route, consumed: input, params: extractParams(cp, exactMatch) };
    }

    if (route.hasNestedOutlet) {
      const prefixMatch = cp.prefix.exec(input);
      if (prefixMatch) {
        return {
          route,
          consumed: prefixMatch[0],
          params: extractParams(cp, prefixMatch),
        };
      }
    }
  }

  if (fallback) return { route: fallback, consumed: input, params: {} };
  return null;
}

export function computeRemainder(input: string, consumed: string): string {
  if (!input.startsWith(consumed)) return "";
  const rest = input.slice(consumed.length);
  if (rest === "") return "";
  return rest.startsWith("/") ? rest : "/" + rest;
}
