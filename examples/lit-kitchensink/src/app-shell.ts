import { LitElement, html, render as litRender, type TemplateResult } from "lit";
import { createEffect } from "@solidjs/signals";
import { createRootRoute, createRoute, createRouter, type RouterPaths } from "meowter";
import logoUrl from "../../../meowter-logo.svg?url";

import "./app-nav.ts";
import "./debug-panel.ts";
import "./route-cat-detail.ts";
import "./route-programmatic.ts";
import "./route-search.ts";
import "./route-static.ts";
import { catsShell } from "./route-cats-shell.ts";

/** Helper: render a Lit template into a fresh host div and return the host. */
function renderToHost(template: TemplateResult): HTMLElement {
  const host = document.createElement("div");
  host.classList.add("route-host");
  litRender(template, host);
  return host;
}

const rootRoute = createRootRoute();

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "",
  render: () => renderToHost(html`<route-static name="home"></route-static>`),
});

const catsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cats",
});

const catsIndexRoute = createRoute({
  getParentRoute: () => catsRoute,
  path: "",
  render: () =>
    renderToHost(
      catsShell(html`
        <p>
          Pick a cat above. The list below is the index route's content; the detail/new views
          replace it via the nested outlet.
        </p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Color</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>whiskers</td>
              <td>tabby</td>
              <td>napping</td>
            </tr>
            <tr>
              <td>mittens</td>
              <td>black</td>
              <td>plotting</td>
            </tr>
            <tr>
              <td>biscuit</td>
              <td>orange</td>
              <td>begging</td>
            </tr>
          </tbody>
        </table>
      `),
    ),
});

const catNewRoute = createRoute({
  getParentRoute: () => catsRoute,
  path: "new",
  render: () =>
    renderToHost(
      catsShell(html`
        <h2>New cat</h2>
        <form @submit=${(e: Event) => e.preventDefault()}>
          <label>
            Name
            <input type="text" name="name" placeholder="e.g. Pickles" />
          </label>
          <label>
            Color
            <select name="color">
              <option>tabby</option>
              <option>black</option>
              <option>orange</option>
              <option>calico</option>
            </select>
          </label>
          <button type="submit">Add cat (no-op demo)</button>
        </form>
      `),
    ),
});

const catDetailRoute = createRoute({
  getParentRoute: () => catsRoute,
  path: ":id",
  render: ({ params }) => {
    const host = document.createElement("div");
    host.classList.add("route-host");
    createEffect(
      () => params().id,
      (id) => {
        litRender(catsShell(html`<route-cat-detail .id=${id}></route-cat-detail>`), host);
      },
    );
    return host;
  },
});

const dogsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dogs",
  render: () => renderToHost(html`<route-static name="dogs"></route-static>`),
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  render: () => renderToHost(html`<route-search></route-search>`),
});

const programmaticRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/programmatic",
  render: () => renderToHost(html`<route-programmatic></route-programmatic>`),
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  render: () => renderToHost(html`<route-static name="about"></route-static>`),
});

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  render: () => renderToHost(html`<route-static name="notfound"></route-static>`),
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  catsRoute.addChildren([catsIndexRoute, catNewRoute, catDetailRoute]),
  dogsRoute,
  searchRoute,
  programmaticRoute,
  aboutRoute,
  notFoundRoute,
]);

/** Re-exported for typed navigation in other modules. */
export type AppPaths = RouterPaths<typeof routeTree>;

export const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
});

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
