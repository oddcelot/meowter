export interface RouteChangeDetail {
  url: URL;
  state: unknown;
}

export class MeowRouter extends HTMLElement {
  #onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (href === null) return;

    const targetAttr = anchor.getAttribute("target");
    if (targetAttr !== null && targetAttr !== "_self") return;

    if (anchor.hasAttribute("download")) return;

    const rel = anchor.getAttribute("rel");
    if (rel !== null && rel.split(/\s+/).includes("external")) return;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;

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
    const current = window.location.pathname + window.location.search + window.location.hash;
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

declare global {
  interface HTMLElementTagNameMap {
    "meow-router": MeowRouter;
  }
  interface HTMLElementEventMap {
    "route-change": CustomEvent<RouteChangeDetail>;
  }
}
