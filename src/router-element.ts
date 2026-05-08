import type { RouteChangeDetail } from "./events.ts";
import { shouldInterceptLinkClick } from "./link-intercept.ts";

export class MeowRouter extends HTMLElement {
  #onClick = (event: MouseEvent): void => {
    const url = shouldInterceptLinkClick(event);
    if (!url) return;
    event.preventDefault();
    this.navigate(url.href);
  };

  #onPopState = (event: PopStateEvent): void => {
    this.#emit(new URL(window.location.href), event.state);
  };

  connectedCallback(): void {
    this.addEventListener("click", this.#onClick, { capture: true });
    window.addEventListener("popstate", this.#onPopState);
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
