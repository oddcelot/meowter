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

  #onClick = (event: MouseEvent): void => {
    const url = shouldInterceptLinkClick(event);
    if (!url) return;
    event.preventDefault();
    this.navigate(url.href);
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

  navigate(href: string, state?: unknown): void {
    const url = new URL(href, window.location.href);
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

  replace(href: string, state?: unknown): void {
    const url = new URL(href, window.location.href);
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
    if (mode === "push") this.navigate(url.href);
    else this.replace(url.href);
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
