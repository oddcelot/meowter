import {
  createSignal,
  createStore,
  flush,
  type Accessor,
} from "@solidjs/signals";
import type {
  HistoryEntry,
  HistoryState,
  RouteChangeDetail,
  SearchParamValue,
  SetSearchParamOptions,
} from "./events.ts";
import type { RegisteredPath } from "./index.ts";
import { shouldInterceptLinkClick } from "./link-intercept.ts";

const HISTORY_KEY = "__meowterHistoryId";

interface WrappedState {
  [HISTORY_KEY]: number;
  user: unknown;
}

function isWrapped(s: unknown): s is WrappedState {
  return (
    typeof s === "object" &&
    s !== null &&
    HISTORY_KEY in s &&
    typeof (s as Record<string, unknown>)[HISTORY_KEY] === "number"
  );
}

function unwrapUser(s: unknown): unknown {
  return isWrapped(s) ? s.user : s;
}

function readHistoryId(s: unknown): number | null {
  return isWrapped(s) ? s[HISTORY_KEY] : null;
}

function wrap(id: number, user: unknown): WrappedState {
  return { [HISTORY_KEY]: id, user };
}

function paramsFromURL(url: URL): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, value] of url.searchParams) {
    (result[key] ??= []).push(value);
  }
  return result;
}

const INITIAL_URL = new URL(
  typeof window !== "undefined" ? window.location.href : "http://localhost/",
);

export class MeowRouter extends HTMLElement {
  #url = createSignal<URL>(INITIAL_URL, {
    ownedWrite: true,
    equals: (a, b) => a.href === b.href,
  });
  #state = createSignal<unknown>(null, { ownedWrite: true });
  #nextHistoryId = 0;
  #history = createStore<HistoryState>({ entries: [], index: -1 });
  #searchParams = createStore<Record<string, string[]>>(
    () => paramsFromURL(this.#url[0]()),
    {},
  );

  get currentURL(): Accessor<URL> {
    return this.#url[0];
  }

  get currentState(): Accessor<unknown> {
    return this.#state[0];
  }

  get searchParams(): Record<string, string[]> {
    return this.#searchParams[0];
  }

  get history(): HistoryState {
    return this.#history[0];
  }

  /**
   * Sub-path the router operates within. Defaults to `"/"`. Set via the
   * `base` attribute (e.g. `<meow-router base="/meowter/">`) for sub-path
   * deploys (GitHub Pages, etc.). Always normalized to a trailing slash.
   */
  get base(): string {
    const attr = this.getAttribute("base");
    if (!attr || attr === "/") return "/";
    return attr.endsWith("/") ? attr : attr + "/";
  }

  /**
   * Current pathname with the configured `base` stripped. Outlets match
   * against this so route paths can be authored base-less.
   */
  get routablePathname(): Accessor<string> {
    return this.#routablePathnameAcc;
  }

  #routablePathnameAcc = (): string => {
    return this.#stripBase(this.#url[0]().pathname);
  };

  #stripBase(pathname: string): string {
    const base = this.base;
    if (base === "/") return pathname;
    const trimmed = base.replace(/\/$/, ""); // "/meowter"
    if (pathname === trimmed) return "/";
    if (pathname.startsWith(trimmed + "/")) {
      return pathname.slice(trimmed.length);
    }
    return pathname;
  }

  /**
   * Prepend `base` to `href` if it's a base-less absolute path. Full
   * URLs and already-prefixed paths pass through unchanged.
   */
  #applyBase(href: string): string {
    const base = this.base;
    if (base === "/") return href;
    let url: URL;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return href;
    }
    const trimmed = base.replace(/\/$/, "");
    if (url.pathname === trimmed || url.pathname.startsWith(trimmed + "/")) {
      return url.href;
    }
    if (url.pathname.startsWith("/")) {
      url.pathname = trimmed + url.pathname;
      return url.href;
    }
    return href;
  }

  #onClick = (event: MouseEvent): void => {
    const url = shouldInterceptLinkClick(event);
    if (!url) return;
    event.preventDefault();
    this.navigate(url.href as RegisteredPath);
  };

  #onPopState = (event: PopStateEvent): void => {
    const url = new URL(window.location.href);
    const userState = unwrapUser(event.state);
    const id = readHistoryId(event.state);

    this.#history[1]((s) => {
      if (id != null) {
        const idx = s.entries.findIndex((e) => e.id === id);
        if (idx >= 0) {
          s.index = idx;
          s.entries[idx]!.href = url.href;
          s.entries[idx]!.state = userState;
          return;
        }
      }
      const newId = id ?? this.#nextHistoryId++;
      s.entries = [{ id: newId, href: url.href, state: userState }];
      s.index = 0;
    });

    this.#url[1](url);
    this.#state[1](userState);
    flush();
    this.#emit(url, userState);
  };

  connectedCallback(): void {
    this.addEventListener("click", this.#onClick, { capture: true });
    window.addEventListener("popstate", this.#onPopState);

    const url = new URL(window.location.href);
    const raw = window.history.state;
    const userState = unwrapUser(raw);
    const existingId = readHistoryId(raw);
    const id = existingId ?? this.#nextHistoryId++;

    this.#history[1]((s) => {
      s.entries = [{ id, href: url.href, state: userState }];
      s.index = 0;
    });

    this.#url[1](url);
    this.#state[1](userState);
    flush();
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick, { capture: true });
    window.removeEventListener("popstate", this.#onPopState);
  }

  navigate(href: RegisteredPath, state?: unknown): void {
    const finalHref = this.#applyBase(href);
    const url = new URL(finalHref, window.location.href);
    const current =
      window.location.pathname + window.location.search + window.location.hash;
    const next = url.pathname + url.search + url.hash;

    if (current !== next) {
      const id = this.#nextHistoryId++;
      window.history.pushState(wrap(id, state ?? null), "", url.href);

      this.#history[1]((s) => {
        if (s.index < s.entries.length - 1) {
          s.entries.length = s.index + 1;
        }
        s.entries.push({ id, href: url.href, state: state ?? null });
        s.index = s.entries.length - 1;
      });
    }

    this.#url[1](url);
    this.#state[1](state ?? null);
    flush();
    this.#emit(url, state ?? null);
  }

  replace(href: RegisteredPath, state?: unknown): void {
    const finalHref = this.#applyBase(href);
    const url = new URL(finalHref, window.location.href);
    const id = this.#nextHistoryId++;
    window.history.replaceState(wrap(id, state ?? null), "", url.href);

    this.#history[1]((s) => {
      const entry: HistoryEntry = { id, href: url.href, state: state ?? null };
      if (s.index >= 0 && s.index < s.entries.length) {
        s.entries[s.index] = entry;
      } else {
        s.entries.push(entry);
        s.index = s.entries.length - 1;
      }
    });

    this.#url[1](url);
    this.#state[1](state ?? null);
    flush();
    this.#emit(url, state ?? null);
  }

  setSearchParam(
    key: string,
    value: SearchParamValue,
    options: SetSearchParamOptions = {},
  ): void {
    const url = new URL(window.location.href);
    url.searchParams.delete(key);
    if (value !== null) {
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, v);
      } else {
        url.searchParams.set(key, value);
      }
    }
    const mode = options.history ?? "replace";
    if (mode === "push") this.navigate(url.href as RegisteredPath);
    else this.replace(url.href as RegisteredPath);
  }

  #emit(url: URL, state: unknown): void {
    this.dispatchEvent(
      new CustomEvent<RouteChangeDetail>("route-change", {
        detail: { url, state },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (!customElements.get("meow-router")) {
  customElements.define("meow-router", MeowRouter);
}
