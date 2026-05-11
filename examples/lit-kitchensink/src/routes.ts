import { html, render as litRender, type TemplateResult } from "lit";
import { createEffect } from "@solidjs/signals";
import { createRootRoute, createRoute, createRouter, type RouterPaths } from "meowter";

import "./route-cat-detail.ts";
import "./route-programmatic.ts";
import "./route-search.ts";
import "./route-static.ts";
import { catsShell } from "./route-cats-shell.ts";

/** Render a Lit template into a fresh host div and return the host. */
function renderToHost(template: TemplateResult): HTMLElement {
  const host = document.createElement("div");
  host.classList.add("route-host");
  litRender(template, host);
  return host;
}

export const rootRoute = createRootRoute();

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "",
  render: () => renderToHost(html`<route-static name="home"></route-static>`),
});

export const catsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cats",
});

export const catsIndexRoute = createRoute({
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

export const catNewRoute = createRoute({
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

export const catDetailRoute = createRoute({
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

export const dogsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dogs",
  render: () => renderToHost(html`<route-static name="dogs"></route-static>`),
});

export const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  render: () => renderToHost(html`<route-search></route-search>`),
});

export const programmaticRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/programmatic",
  render: () => renderToHost(html`<route-programmatic></route-programmatic>`),
});

export const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  render: () => renderToHost(html`<route-static name="about"></route-static>`),
});

export const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  render: () => renderToHost(html`<route-static name="notfound"></route-static>`),
});

export const routeTree = rootRoute.addChildren([
  homeRoute,
  catsRoute.addChildren([catsIndexRoute, catNewRoute, catDetailRoute]),
  dogsRoute,
  searchRoute,
  programmaticRoute,
  aboutRoute,
  notFoundRoute,
]);

/** Typed union of all registered paths — use for navigation in other modules. */
export type AppPaths = RouterPaths<typeof routeTree>;

// `import.meta.env` is Vite-only. Read it safely so scripts running in plain
// Node (e.g. `pnpm cem:routes`) can import this module without crashing.
const VITE_ENV = (import.meta as { env?: { BASE_URL?: string } }).env;
const BASE_URL = VITE_ENV?.BASE_URL ?? "/";

export const router = createRouter({
  routeTree,
  basepath: BASE_URL,
});
