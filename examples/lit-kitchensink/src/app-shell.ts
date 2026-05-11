import { LitElement, html, type TemplateResult } from "lit";
import logoUrl from "../../../meowter-logo.svg?url";

import "./app-nav.ts";
import "./debug-panel.ts";
import { router } from "./routes.ts";

export class AppShell extends LitElement {
  #mounted = false;

  override createRenderRoot(): HTMLElement {
    return this;
  }

  override render(): TemplateResult {
    return html`
      <meow-router basepath=${import.meta.env.BASE_URL}>
        <div class="layout">
          <aside>
            <header class="brand">
              <img src=${logoUrl} alt="meowter logo" />
              <hgroup>
                <h2>meowter</h2>
                <p>kitchen sink · lit</p>
              </hgroup>
            </header>

            <app-nav></app-nav>

            <debug-panel></debug-panel>
          </aside>

          <main class="container">
            <div id="outlet-host"></div>
          </main>
        </div>
      </meow-router>
    `;
  }

  override firstUpdated(): void {
    if (this.#mounted) return;
    const host = this.querySelector("#outlet-host");
    if (!(host instanceof HTMLElement)) return;
    router.mount(host);
    this.#mounted = true;
  }
}

if (!customElements.get("app-shell")) {
  customElements.define("app-shell", AppShell);
}
