import { LitElement, html, type TemplateResult } from "lit";
import logoUrl from "../../../meowter-logo.svg?url";

import "./app-nav.ts";
import "./debug-panel.ts";
import "./route-cats.ts";
import "./route-cat-detail.ts";
import "./route-programmatic.ts";
import "./route-search.ts";
import "./route-static.ts";

export class AppShell extends LitElement {
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
            <meow-outlet>
              <meow-route path="/">
                <route-static name="home"></route-static>
              </meow-route>

              <meow-route path="/cats">
                <article>
                  <header>
                    <h1>Cats</h1>
                    <nav>
                      <ul>
                        <li><a href="/cats">All</a></li>
                        <li><a href="/cats/new">New</a></li>
                        <li><a href="/cats/whiskers">Whiskers</a></li>
                        <li><a href="/cats/mittens">Mittens</a></li>
                        <li><a href="/cats/biscuit">Biscuit</a></li>
                      </ul>
                    </nav>
                  </header>
                  <meow-outlet>
                    <meow-route path="">
                      <route-cats-index></route-cats-index>
                    </meow-route>
                    <meow-route path="new">
                      <route-cat-new></route-cat-new>
                    </meow-route>
                    <meow-route path=":id">
                      <route-cat-detail></route-cat-detail>
                    </meow-route>
                  </meow-outlet>
                </article>
              </meow-route>

              <meow-route path="/dogs">
                <route-static name="dogs"></route-static>
              </meow-route>

              <meow-route path="/search">
                <route-search></route-search>
              </meow-route>

              <meow-route path="/programmatic">
                <route-programmatic></route-programmatic>
              </meow-route>

              <meow-route path="/about">
                <route-static name="about"></route-static>
              </meow-route>

              <meow-route path="*">
                <route-static name="notfound"></route-static>
              </meow-route>
            </meow-outlet>
          </main>
        </div>
      </meow-router>
    `;
  }
}

if (!customElements.get("app-shell")) {
  customElements.define("app-shell", AppShell);
}
