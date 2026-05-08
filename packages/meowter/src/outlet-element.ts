import {
  createMemo,
  createRenderEffect,
  createRoot,
  runWithOwner,
  type Accessor,
} from "@solidjs/signals";
import { computeRemainder, selectFor, type RouteCandidate } from "./path-select.ts";
import { MeowRoute } from "./route-element.ts";
import { MeowRouter } from "./router-element.ts";

const NULL_REMAINDER: Accessor<string> = () => "";
const NULL_SELECTED: Accessor<MeowRoute | null> = () => null;

export class MeowOutlet extends HTMLElement {
  remainder: Accessor<string> = NULL_REMAINDER;
  selectedRoute: Accessor<MeowRoute | null> = NULL_SELECTED;
  #disposeRoot: (() => void) | null = null;
  #setupScheduled = false;

  connectedCallback(): void {
    if (this.#setupScheduled) return;
    this.#setupScheduled = true;
    queueMicrotask(() => this.#setup());
  }

  disconnectedCallback(): void {
    this.#disposeRoot?.();
    this.#disposeRoot = null;
    this.#setupScheduled = false;
    this.remainder = NULL_REMAINDER;
    this.selectedRoute = NULL_SELECTED;
  }

  #setup(): void {
    if (!this.isConnected) return;

    const router = this.closest("meow-router");
    if (!(router instanceof MeowRouter)) return;

    const ancestorOutlet = this.#findAncestorOutlet(router);
    const ancestorRoute = this.#findAncestorRoute(router);

    const directRoutes: MeowRoute[] = [];
    for (const child of Array.from(this.children)) {
      if (child instanceof MeowRoute) directRoutes.push(child);
    }

    const candidates: Array<{ route: MeowRoute } & RouteCandidate> = directRoutes.map(
      (route) => ({
        route,
        compiledPath: route.compiledPath,
        hasNestedOutlet: route.querySelector("meow-outlet") !== null,
      }),
    );

    this.#disposeRoot = runWithOwner(null, () => createRoot((dispose) => {
      const reachable = createMemo<boolean>(() => {
        if (!ancestorOutlet || !ancestorRoute) return true;
        return ancestorOutlet.selectedRoute() === ancestorRoute;
      });

      const input = createMemo<string>(() => {
        if (ancestorOutlet) return ancestorOutlet.remainder();
        return router.currentURL().pathname;
      });

      const selection = createMemo(() => {
        if (!reachable()) return null;
        return selectFor(input(), candidates);
      });

      this.selectedRoute = createMemo<MeowRoute | null>(
        () => selection()?.route.route ?? null,
      );

      this.remainder = createMemo<string>(() => {
        const sel = selection();
        return sel ? computeRemainder(input(), sel.consumed) : "";
      });

      createRenderEffect<ReturnType<typeof selection>>(
        () => selection(),
        (sel) => {
          for (const { route } of candidates) {
            if (sel === null || sel.route.route !== route) route.deactivate();
          }
          if (sel) sel.route.route.activate(sel.params, sel.consumed);
        },
      );

      return dispose;
    }));
  }

  #findAncestorOutlet(router: MeowRouter): MeowOutlet | null {
    let walker: Element | null = this.parentElement;
    while (walker && walker !== router) {
      if (walker instanceof MeowOutlet) return walker;
      walker = walker.parentElement;
    }
    return null;
  }

  #findAncestorRoute(router: MeowRouter): MeowRoute | null {
    let walker: Element | null = this.parentElement;
    while (walker && walker !== router) {
      if (walker instanceof MeowRoute) return walker;
      walker = walker.parentElement;
    }
    return null;
  }
}

if (!customElements.get("meow-outlet")) {
  customElements.define("meow-outlet", MeowOutlet);
}
