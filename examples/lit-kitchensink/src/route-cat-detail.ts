import { LitElement, html, type TemplateResult } from "lit";
import type { MeowRoute } from "meowter";
import { SignalsController } from "./signals-controller.ts";

export class RouteCatDetail extends LitElement {
  #id = "";

  constructor() {
    super();
    new SignalsController(this, (track) => {
      const route = this.#route();
      if (!route) return;
      track(
        () => route.paramsAccessor()?.["id"] ?? "",
        (id) => {
          this.#id = id;
        },
      );
    });
  }

  override createRenderRoot(): HTMLElement {
    return this;
  }

  #route(): MeowRoute | null {
    return this.closest<MeowRoute>("meow-route");
  }

  override render(): TemplateResult {
    return html`
      <h2>Detail: <span>${this.#id}</span></h2>
      <p>
        This route demonstrates a dynamic parameter. The <code>:id</code>
        segment is exposed via <code>route.params</code> /
        <code>route.paramsAccessor()</code>.
      </p>
      <p>
        The Lit component reads the parent <code>&lt;meow-route&gt;</code>'s
        <code>paramsAccessor()</code> through a small reactive controller and
        rerenders when it changes.
      </p>
    `;
  }
}

if (!customElements.get("route-cat-detail")) {
  customElements.define("route-cat-detail", RouteCatDetail);
}
