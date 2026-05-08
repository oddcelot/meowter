import type { RouteMatchDetail, RouteLeaveDetail } from "./events.ts";
import type { CompiledPath } from "./path-compile.ts";
import { compilePath } from "./path-compile.ts";

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

if (!customElements.get("meow-route")) {
  customElements.define("meow-route", MeowRoute);
}
