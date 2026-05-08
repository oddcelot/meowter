import { createSignal, flush, type Accessor } from "@solidjs/signals";
import type { RouteChangeDetail } from "./events.ts";
import { shouldInterceptLinkClick } from "./link-intercept.ts";

const INITIAL_URL = new URL(
  typeof window !== "undefined" ? window.location.href : "http://localhost/",
);

export class MeowRouter extends HTMLElement {
  #url = createSignal<URL>(INITIAL_URL, {
    pureWrite: true,
    equals: (a, b) => a.href === b.href,
  });
  #state = createSignal<unknown>(null, { pureWrite: true });

  get currentURL(): Accessor<URL> {
    return this.#url[0];
  }

  get currentState(): Accessor<unknown> {
    return this.#state[0];
  }

  #onClick = (event: MouseEvent): void => {
    const url = shouldInterceptLinkClick(event);
    if (!url) return;
    event.preventDefault();
    this.navigate(url.href);
  };

  #onPopState = (event: PopStateEvent): void => {
    const url = new URL(window.location.href);
    this.#url[1](url);
    this.#state[1](event.state);
    flush();
    this.#emit(url, event.state);
  };

  connectedCallback(): void {
    this.addEventListener("click", this.#onClick, { capture: true });
    window.addEventListener("popstate", this.#onPopState);
    this.#url[1](new URL(window.location.href));
    this.#state[1](window.history.state);
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
      window.history.pushState(state ?? null, "", url.href);
    }

    this.#url[1](url);
    this.#state[1](state ?? null);
    flush();
    this.#emit(url, state ?? null);
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
