import { computeRemainder, selectFor } from "./path-select.ts";
import { MeowRoute } from "./route-element.ts";

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

    const routes = this.#directRoutes();

    if (!this.#ancestorChainActive()) {
      for (const route of routes) route.deactivate();
      this.remainder = "";
      return;
    }

    const candidates = routes.map((route) => ({
      route,
      compiledPath: route.compiledPath,
      hasNestedOutlet: route.querySelector("meow-outlet") !== null,
    }));

    const input = this.#computeInput();
    const result = selectFor(input, candidates);

    for (const route of routes) {
      if (result === null || result.route.route !== route) route.deactivate();
    }

    if (result) {
      result.route.route.activate(result.params, result.consumed);
      this.remainder = computeRemainder(input, result.consumed);
    } else {
      this.remainder = "";
    }
  }
}

if (!customElements.get("meow-outlet")) {
  customElements.define("meow-outlet", MeowOutlet);
}
