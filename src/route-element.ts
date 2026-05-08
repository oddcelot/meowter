import { createSignal, flush, untrack, type Accessor } from "@solidjs/signals";
import type { RouteMatchDetail, RouteLeaveDetail } from "./events.ts";
import type { CompiledPath } from "./path-compile.ts";
import { compilePath } from "./path-compile.ts";

type ParamsRecord = Record<string, string>;

export class MeowRoute extends HTMLElement {
  #matched = createSignal<boolean>(false, { ownedWrite: true });
  #params = createSignal<ParamsRecord | null>(null, { ownedWrite: true });
  #compiled: CompiledPath | null = null;

  get matched(): boolean {
    return this.#matched[0]();
  }

  get matchedAccessor(): Accessor<boolean> {
    return this.#matched[0];
  }

  get params(): ParamsRecord | null {
    return this.#params[0]();
  }

  get paramsAccessor(): Accessor<ParamsRecord | null> {
    return this.#params[0];
  }

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

  activate(params: ParamsRecord, consumed: string): void {
    const wasMatched = untrack(this.#matched[0]);
    this.#params[1](params);
    this.#matched[1](true);
    flush();
    this.hidden = false;
    if (!wasMatched) {
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
    const wasMatched = untrack(this.#matched[0]);
    this.#params[1](null);
    this.#matched[1](false);
    flush();
    this.hidden = true;
    if (wasMatched) {
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
