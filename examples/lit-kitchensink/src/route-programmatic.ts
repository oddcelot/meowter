import { LitElement, html, type TemplateResult } from "lit";
import { aboutRoute, catDetailRoute, homeRoute, router } from "./routes.ts";

export class RouteProgrammatic extends LitElement {
  override createRenderRoot(): HTMLElement {
    return this;
  }

  // Each handler showcases a different shape of the typed `navigate` API.
  #goHome = (): void => router.navigate({ to: homeRoute });
  #goWhiskers = (): void => router.navigate({ to: catDetailRoute, params: { id: "whiskers" } });
  #replaceMittens = (): void =>
    router.navigate({ to: catDetailRoute, params: { id: "mittens" }, replace: true });
  #aboutWithState = (): void => router.navigate({ to: aboutRoute, state: { from: "demo" } });

  override render(): TemplateResult {
    return html`
      <article>
        <header><h1>Programmatic</h1></header>
        <p>
          Buttons that call <code>router.navigate({ to: route, params })</code>
          directly — params are type-checked against each route's path string.
        </p>
        <div class="grid">
          <button @click=${this.#goHome}>navigate({to: homeRoute})</button>
          <button @click=${this.#goWhiskers}>
            navigate({to: catDetailRoute, params: {id:"whiskers"}})
          </button>
          <button @click=${this.#replaceMittens}>
            navigate({to: catDetailRoute, params: {id:"mittens"}, replace: true})
          </button>
          <button @click=${this.#aboutWithState}>
            navigate({to: aboutRoute, state: {from:"demo"}})
          </button>
        </div>
        <div class="grid">
          <button class="secondary" @click=${() => window.history.back()}>history.back()</button>
          <button class="secondary" @click=${() => window.history.forward()}>
            history.forward()
          </button>
        </div>
      </article>
    `;
  }
}

if (!customElements.get("route-programmatic")) {
  customElements.define("route-programmatic", RouteProgrammatic);
}
