import "./router.ts";

export interface RouteMatchDetail {
  url: URL;
  params: Record<string, string>;
  consumed: string;
}

export interface RouteLeaveDetail {
  url: URL;
}

interface CompiledPath {
  raw: string;
  paramNames: string[];
  exact: RegExp;
  prefix: RegExp;
  isIndex: boolean;
  isCatchAll: boolean;
}

interface SelectResult {
  route: MeowRoute;
  consumed: string;
  params: Record<string, string>;
}

const SEGMENT_RE = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(s: string): string {
  return s.replace(SEGMENT_RE, "\\$&");
}

function compilePath(raw: string): CompiledPath {
  const isIndex = raw === "";
  const isCatchAll = raw === "*";

  if (isIndex || isCatchAll) {
    return {
      raw,
      paramNames: [],
      exact: /^$/,
      prefix: /^/,
      isIndex,
      isCatchAll,
    };
  }

  const paramNames: string[] = [];
  const normalized = raw.startsWith("/") ? raw : "/" + raw;
  const segments = normalized.split("/").filter((s) => s.length > 0);

  let pattern = "";
  for (const seg of segments) {
    if (seg.startsWith(":")) {
      paramNames.push(seg.slice(1));
      pattern += "/([^/]+)";
    } else {
      pattern += "/" + escapeRegex(seg);
    }
  }

  return {
    raw,
    paramNames,
    exact: new RegExp(`^${pattern}\\/?$`),
    prefix: new RegExp(`^${pattern}(?=\\/|$)`),
    isIndex: false,
    isCatchAll: false,
  };
}

function extractParams(cp: CompiledPath, match: RegExpExecArray): Record<string, string> {
  const params: Record<string, string> = {};
  cp.paramNames.forEach((name, i) => {
    const v = match[i + 1];
    if (v !== undefined) params[name] = decodeURIComponent(v);
  });
  return params;
}

function selectFor(rawInput: string, routes: MeowRoute[]): SelectResult | null {
  const input = rawInput === "" ? "/" : rawInput;
  let fallback: MeowRoute | null = null;

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

    if (route.querySelector("meow-outlet") !== null) {
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

function computeRemainder(input: string, consumed: string): string {
  if (!input.startsWith(consumed)) return "";
  const rest = input.slice(consumed.length);
  if (rest === "") return "";
  return rest.startsWith("/") ? rest : "/" + rest;
}

export class MeowRoute extends HTMLElement {
  matched = false;
  params: Record<string, string> | null = null;
  #compiled: CompiledPath | null = null;

  get path(): string {
    return this.getAttribute("path") ?? "";
  }

  get compiledPath(): CompiledPath {
    if (this.#compiled === null || this.#compiled.raw !== this.path) {
      this.#compiled = compilePath(this.path);
    }
    return this.#compiled;
  }

  connectedCallback(): void {
    if (!this.matched) this.hidden = true;
  }

  activate(params: Record<string, string>, consumed: string): void {
    this.params = params;
    this.hidden = false;
    if (!this.matched) {
      this.matched = true;
      this.dispatchEvent(
        new CustomEvent<RouteMatchDetail>("route-match", {
          detail: { url: new URL(window.location.href), params, consumed },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  deactivate(): void {
    this.hidden = true;
    this.params = null;
    if (this.matched) {
      this.matched = false;
      this.dispatchEvent(
        new CustomEvent<RouteLeaveDetail>("route-leave", {
          detail: { url: new URL(window.location.href) },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
}

export class MeowOutlet extends HTMLElement {
  remainder = "";
  #router: HTMLElement | null = null;
  #onRouteChange = (): void => this.#evaluate();

  connectedCallback(): void {
    this.#router = this.closest("meow-router");
    if (this.#router) {
      this.#router.addEventListener("route-change", this.#onRouteChange);
    }
    queueMicrotask(() => this.#evaluate());
  }

  disconnectedCallback(): void {
    if (this.#router) {
      this.#router.removeEventListener("route-change", this.#onRouteChange);
      this.#router = null;
    }
  }

  #directRoutes(): MeowRoute[] {
    const out: MeowRoute[] = [];
    for (const child of Array.from(this.children)) {
      if (child instanceof MeowRoute) out.push(child);
    }
    return out;
  }

  #ancestorChainActive(): boolean {
    let walker: Element | null = this.parentElement;
    while (walker && walker !== this.#router) {
      if (walker instanceof MeowRoute && !walker.matched) return false;
      walker = walker.parentElement;
    }
    return true;
  }

  #computeInput(): string {
    let walker: Element | null = this.parentElement;
    while (walker && walker !== this.#router) {
      if (walker instanceof MeowOutlet) return walker.remainder;
      walker = walker.parentElement;
    }
    return window.location.pathname;
  }

  #evaluate(): void {
    if (!this.isConnected) return;

    if (!this.#ancestorChainActive()) {
      for (const route of this.#directRoutes()) route.deactivate();
      this.remainder = "";
      return;
    }

    const input = this.#computeInput();
    const routes = this.#directRoutes();
    const result = selectFor(input, routes);

    for (const route of routes) {
      if (result === null || result.route !== route) route.deactivate();
    }

    if (result) {
      result.route.activate(result.params, result.consumed);
      this.remainder = computeRemainder(input, result.consumed);
    } else {
      this.remainder = "";
    }
  }
}

let styleInjected = false;
function ensureStyle(): void {
  if (styleInjected) return;
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.dataset["meowterFouc"] = "";
  style.textContent = "meow-route:not(:defined),meow-outlet:not(:defined){display:none}";
  document.head.appendChild(style);
  styleInjected = true;
}

ensureStyle();

if (!customElements.get("meow-route")) {
  customElements.define("meow-route", MeowRoute);
}
if (!customElements.get("meow-outlet")) {
  customElements.define("meow-outlet", MeowOutlet);
}

declare global {
  interface HTMLElementTagNameMap {
    "meow-route": MeowRoute;
    "meow-outlet": MeowOutlet;
  }
  interface HTMLElementEventMap {
    "route-match": CustomEvent<RouteMatchDetail>;
    "route-leave": CustomEvent<RouteLeaveDetail>;
  }
}
