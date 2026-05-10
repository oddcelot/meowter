import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "./index.ts";
import type { MeowRouter } from "./router-element.ts";
import type { MeowRoute } from "./route-element.ts";
import type { MeowOutlet } from "./outlet-element.ts";
import type { RouteMatchDetail, RouteLeaveDetail } from "./events.ts";

function setURL(path: string): void {
  window.history.replaceState(null, "", path);
}

function mount(html: string): MeowRouter {
  document.body.innerHTML = `<meow-router>${html}</meow-router>`;
  return document.body.firstElementChild as MeowRouter;
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function getRoute(root: ParentNode, path: string): MeowRoute {
  const r = root.querySelector<MeowRoute>(`meow-route[path="${path}"]`);
  if (!r) throw new Error(`route not found: ${path}`);
  return r;
}

describe("MeowOutlet selection", () => {
  beforeEach(() => {
    setURL("/");
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the matching top-level route, hides others", async () => {
    setURL("/cats");
    const router = mount(`
      <meow-outlet>
        <meow-route path="/">home</meow-route>
        <meow-route path="/cats">cats</meow-route>
      </meow-outlet>
    `);
    await flush();
    expect(getRoute(router, "/").hidden).toBe(true);
    expect(getRoute(router, "/cats").hidden).toBe(false);
  });

  it("evaluates current URL on initial connect (no nav needed)", async () => {
    setURL("/cats");
    const router = mount(`
      <meow-outlet>
        <meow-route path="/cats">cats</meow-route>
      </meow-outlet>
    `);
    await flush();
    expect(getRoute(router, "/cats").matched).toBe(true);
  });

  it("extracts :params and exposes them via route.params and route-match event", async () => {
    setURL("/cats/whiskers");
    const router = mount(`
      <meow-outlet>
        <meow-route path="/cats/:id">detail</meow-route>
      </meow-outlet>
    `);
    let detail: RouteMatchDetail | null = null;
    getRoute(router, "/cats/:id").addEventListener("route-match", (e) => {
      detail = e.detail;
    });
    await flush();
    const route = getRoute(router, "/cats/:id");
    expect(route.matched).toBe(true);
    expect(route.params).toEqual({ id: "whiskers" });
    expect(detail!.params).toEqual({ id: "whiskers" });
  });

  it("supports nested outlets with index, param, and parent visibility", async () => {
    const html = `
      <meow-outlet>
        <meow-route path="/">home</meow-route>
        <meow-route path="/cats" id="cats">
          <meow-outlet>
            <meow-route path="">all</meow-route>
            <meow-route path=":id">detail</meow-route>
          </meow-outlet>
        </meow-route>
      </meow-outlet>
    `;

    setURL("/cats");
    let router = mount(html);
    await flush();
    expect(router.querySelector<MeowRoute>("#cats")!.hidden).toBe(false);
    expect(getRoute(router, "").hidden).toBe(false);
    expect(getRoute(router, ":id").hidden).toBe(true);

    document.body.innerHTML = "";
    setURL("/cats/whiskers");
    router = mount(html);
    await flush();
    expect(router.querySelector<MeowRoute>("#cats")!.hidden).toBe(false);
    expect(getRoute(router, "").hidden).toBe(true);
    expect(getRoute(router, ":id").hidden).toBe(false);
    expect(getRoute(router, ":id").params).toEqual({ id: "whiskers" });

    document.body.innerHTML = "";
    setURL("/");
    router = mount(html);
    await flush();
    expect(router.querySelector<MeowRoute>("#cats")!.hidden).toBe(true);
    expect(getRoute(router, ":id").hidden).toBe(true);
    expect(getRoute(router, "/").hidden).toBe(false);
  });

  it("only one sibling route is shown at a time", async () => {
    setURL("/dogs");
    const router = mount(`
      <meow-outlet>
        <meow-route path="/cats">cats</meow-route>
        <meow-route path="/dogs">dogs</meow-route>
        <meow-route path="/birds">birds</meow-route>
      </meow-outlet>
    `);
    await flush();
    const visible = router.querySelectorAll<MeowRoute>("meow-route:not([hidden])");
    expect(visible).toHaveLength(1);
    expect(visible[0]!.getAttribute("path")).toBe("/dogs");
  });

  it("falls back to path=\"*\" only when no sibling matches", async () => {
    setURL("/cats");
    let router = mount(`
      <meow-outlet>
        <meow-route path="/cats">cats</meow-route>
        <meow-route path="*">404</meow-route>
      </meow-outlet>
    `);
    await flush();
    expect(getRoute(router, "/cats").hidden).toBe(false);
    expect(getRoute(router, "*").hidden).toBe(true);

    document.body.innerHTML = "";
    setURL("/garbage");
    router = mount(`
      <meow-outlet>
        <meow-route path="/cats">cats</meow-route>
        <meow-route path="*">404</meow-route>
      </meow-outlet>
    `);
    await flush();
    expect(getRoute(router, "/cats").hidden).toBe(true);
    expect(getRoute(router, "*").hidden).toBe(false);
  });

  it("propagates programmatic navigate() through nested outlets", async () => {
    setURL("/");
    const router = mount(`
      <meow-outlet>
        <meow-route path="/">home</meow-route>
        <meow-route path="/cats">
          <meow-outlet>
            <meow-route path="">all</meow-route>
            <meow-route path=":id">detail</meow-route>
          </meow-outlet>
        </meow-route>
      </meow-outlet>
    `);
    await flush();
    expect(getRoute(router, "/").hidden).toBe(false);

    router.navigate("/cats/whiskers");
    expect(getRoute(router, "/").hidden).toBe(true);
    expect(getRoute(router, ":id").hidden).toBe(false);
    expect(getRoute(router, ":id").params).toEqual({ id: "whiskers" });
  });

  it("reacts to popstate", async () => {
    setURL("/cats");
    const router = mount(`
      <meow-outlet>
        <meow-route path="/cats">cats</meow-route>
        <meow-route path="/dogs">dogs</meow-route>
      </meow-outlet>
    `);
    await flush();
    expect(getRoute(router, "/cats").hidden).toBe(false);

    window.history.pushState(null, "", "/dogs");
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    expect(getRoute(router, "/cats").hidden).toBe(true);
    expect(getRoute(router, "/dogs").hidden).toBe(false);
  });

  it("fires route-match on enter and route-leave on leave, exactly once each", async () => {
    setURL("/cats");
    const router = mount(`
      <meow-outlet>
        <meow-route path="/cats">cats</meow-route>
        <meow-route path="/dogs">dogs</meow-route>
      </meow-outlet>
    `);

    const matches: RouteMatchDetail[] = [];
    const leaves: RouteLeaveDetail[] = [];
    const cats = getRoute(router, "/cats");
    cats.addEventListener("route-match", (e) => matches.push(e.detail));
    cats.addEventListener("route-leave", (e) => leaves.push(e.detail));

    await flush();
    expect(matches).toHaveLength(1);
    expect(leaves).toHaveLength(0);

    router.navigate("/cats");
    expect(matches).toHaveLength(1);
    expect(leaves).toHaveLength(0);

    router.navigate("/dogs");
    expect(matches).toHaveLength(1);
    expect(leaves).toHaveLength(1);

    router.navigate("/cats");
    expect(matches).toHaveLength(2);
    expect(leaves).toHaveLength(1);
  });

  it("matches routes relative to router basepath", async () => {
    setURL("/x/cats");
    document.body.innerHTML = `
      <meow-router basepath="/x/">
        <meow-outlet>
          <meow-route path="/">home</meow-route>
          <meow-route path="/cats">cats</meow-route>
        </meow-outlet>
      </meow-router>
    `;
    const router = document.body.firstElementChild as MeowRouter;
    await flush();
    expect(getRoute(router, "/").hidden).toBe(true);
    expect(getRoute(router, "/cats").hidden).toBe(false);
  });

  it("re-evaluates outlets when basepath is set after mount", async () => {
    setURL("/x/cats");
    const router = mount(`
      <meow-outlet>
        <meow-route path="/">home</meow-route>
        <meow-route path="/cats">cats</meow-route>
      </meow-outlet>
    `);
    await flush();
    expect(getRoute(router, "/cats").hidden).toBe(true);

    router.basepath = "/x/";
    await flush();
    expect(getRoute(router, "/cats").hidden).toBe(false);
    expect(getRoute(router, "/").hidden).toBe(true);
  });

  it("removes its listener on disconnect", async () => {
    setURL("/cats");
    const router = mount(`
      <meow-outlet>
        <meow-route path="/cats">cats</meow-route>
      </meow-outlet>
    `);
    await flush();
    const outlet = router.querySelector<MeowOutlet>("meow-outlet")!;
    outlet.remove();

    let panicked = false;
    try {
      router.navigate("/dogs");
    } catch {
      panicked = true;
    }
    expect(panicked).toBe(false);
  });
});
