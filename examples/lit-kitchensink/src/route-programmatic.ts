import { LitElement, html, type TemplateResult } from "lit";
import type { MeowRouter } from "meowter";

export class RouteProgrammatic extends LitElement {
  override createRenderRoot(): HTMLElement {
    return this;
  }

  #router(): MeowRouter | null {
    return this.closest<MeowRouter>("meow-router");
  }

  #navigate = (href: string): void => {
    this.#router()?.navigate(href);
  };

  #replace = (href: string): void => {
    this.#router()?.replace(href);
  };

  #navigateWithState = (): void => {
    this.#router()?.navigate("/about", { from: "demo" });
  };

  override render(): TemplateResult {
    return html`
      <article>
        <header><h1>Programmatic</h1></header>
        <p>Buttons that call router methods directly:</p>
        <div class="grid">
          <button @click=${() => this.#navigate("/")}>navigate(/)</button>
          <button @click=${() => this.#navigate("/cats/whiskers")}>navigate(/cats/whiskers)</button>
          <button @click=${() => this.#replace("/cats/mittens")}>replace(/cats/mittens)</button>
          <button @click=${this.#navigateWithState}>navigate(/about, {from:"demo"})</button>
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
