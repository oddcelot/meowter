import { createRenderEffect } from "@solidjs/signals";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "./index.ts";
import { createRootRoute, createRoute, createRouter } from "./create-route.ts";
import type { MeowRoute } from "./route-element.ts";
import { setURL, tick } from "./test-helpers.ts";

beforeEach(() => {
  setURL("/");
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

function makeTree() {
  const rootRoute = createRootRoute();

  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "",
    render: () => "home content",
  });

  const catsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cats",
  });

  const catsIndexRoute = createRoute({
    getParentRoute: () => catsRoute,
    path: "",
    render: () => {
      const span = document.createElement("span");
      span.className = "cats-index";
      span.textContent = "all cats";
      return span;
    },
  });

  const catDetailRoute = createRoute({
    getParentRoute: () => catsRoute,
    path: ":id",
    render: ({ params }) => {
      const span = document.createElement("span");
      span.className = "cat-detail";
      span.textContent = params().id;
      return span;
    },
  });

  const notFoundRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "*",
    render: () => "404 here",
  });

  const routeTree = rootRoute.addChildren([
    homeRoute,
    catsRoute.addChildren([catsIndexRoute, catDetailRoute]),
    notFoundRoute,
  ]);

  return {
    rootRoute,
    homeRoute,
    catsRoute,
    catsIndexRoute,
    catDetailRoute,
    notFoundRoute,
    routeTree,
  };
}

describe("createRoute / createRouter", () => {
  it("derives fullPath by joining parent and child paths", () => {
    const { homeRoute, catsRoute, catsIndexRoute, catDetailRoute, notFoundRoute } = makeTree();
    expect(homeRoute.fullPath).toBe("/");
    expect(catsRoute.fullPath).toBe("/cats");
    expect(catsIndexRoute.fullPath).toBe("/cats");
    expect(catDetailRoute.fullPath).toBe("/cats/:id");
    expect(notFoundRoute.fullPath).toBe("/*");
  });

  it("mount synthesizes <meow-router> with the route tree", async () => {
    const { routeTree } = makeTree();
    const router = createRouter({ routeTree, basepath: "/" });
    router.mount(document.body);
    await tick();

    const routerEl = document.body.querySelector("meow-router");
    expect(routerEl).toBeTruthy();
    const outlets = routerEl!.querySelectorAll("meow-outlet");
    expect(outlets.length).toBeGreaterThanOrEqual(2); // root + nested cats outlet
    const routeEls = routerEl!.querySelectorAll("meow-route");
    expect(routeEls.length).toBe(5);
    const paths = Array.from(routeEls).map((el) => el.getAttribute("path"));
    expect(paths).toEqual(["", "/cats", "", ":id", "*"]);
  });

  it("matches the home route on /", async () => {
    setURL("/");
    const { homeRoute, routeTree } = makeTree();
    const router = createRouter({ routeTree, basepath: "/" });
    router.mount(document.body);
    await tick();
    await tick();
    expect(homeRoute.useMatched()()).toBe(true);
  });

  it("matches a nested dynamic param and exposes typed params accessor", async () => {
    setURL("/cats/whiskers");
    const { catDetailRoute, routeTree } = makeTree();
    const router = createRouter({ routeTree, basepath: "/" });
    router.mount(document.body);
    await tick();
    await tick();

    expect(catDetailRoute.useMatched()()).toBe(true);
    expect(catDetailRoute.useParams()()).toEqual({ id: "whiskers" });

    const detailEl = document.body.querySelector(".cat-detail");
    expect(detailEl?.textContent).toBe("whiskers");
  });

  it("renders catch-all on unknown paths", async () => {
    setURL("/nothing-here");
    const { notFoundRoute, routeTree } = makeTree();
    const router = createRouter({ routeTree, basepath: "/" });
    router.mount(document.body);
    await tick();
    await tick();

    expect(notFoundRoute.useMatched()()).toBe(true);
    const routeEls = document.body.querySelectorAll("meow-route");
    const catchAll = Array.from(routeEls).find(
      (el) => el.getAttribute("path") === "*",
    ) as MeowRoute;
    expect(catchAll.textContent).toContain("404 here");
  });

  it("navigate() updates the URL and re-matches", async () => {
    setURL("/");
    const { homeRoute, catDetailRoute, routeTree } = makeTree();
    const router = createRouter({ routeTree, basepath: "/" });
    router.mount(document.body);
    await tick();
    await tick();

    expect(homeRoute.useMatched()()).toBe(true);
    expect(catDetailRoute.useMatched()()).toBe(false);

    router.navigate("/cats/biscuit");
    await tick();

    expect(homeRoute.useMatched()()).toBe(false);
    expect(catDetailRoute.useMatched()()).toBe(true);
    expect(catDetailRoute.useParams()()).toEqual({ id: "biscuit" });
  });

  it("render output is removed on route-leave", async () => {
    setURL("/cats/whiskers");
    const { routeTree } = makeTree();
    const router = createRouter({ routeTree, basepath: "/" });
    router.mount(document.body);
    await tick();
    await tick();
    expect(document.body.querySelector(".cat-detail")).toBeTruthy();

    router.navigate("/");
    await tick();

    expect(document.body.querySelector(".cat-detail")).toBeNull();
  });

  it("reuses an enclosing <meow-router> ancestor instead of creating a new one", async () => {
    document.body.innerHTML = `<meow-router basepath="/"><div id="host"></div></meow-router>`;
    const host = document.body.querySelector("#host") as HTMLElement;
    const { routeTree } = makeTree();
    const router = createRouter({ routeTree });
    router.mount(host);
    await tick();

    const allRouters = document.body.querySelectorAll("meow-router");
    expect(allRouters.length).toBe(1);
    expect(router.element).toBe(allRouters[0]);
    expect(host.querySelector("meow-outlet")).toBeTruthy();
  });

  it("dispose tears down the synthesized DOM and unbinds listeners", async () => {
    setURL("/");
    const { routeTree } = makeTree();
    const router = createRouter({ routeTree, basepath: "/" });
    const dispose = router.mount(document.body);
    await tick();
    expect(document.body.querySelector("meow-router")).toBeTruthy();

    dispose();
    expect(document.body.querySelector("meow-router")).toBeNull();
    expect(router.element).toBeNull();
  });

  it("disposes reactive computations created in render when the route is left", async () => {
    setURL("/cats/a");
    let runs = 0;
    const rootRoute = createRootRoute();
    const catsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/cats" });
    const catDetailRoute = createRoute({
      getParentRoute: () => catsRoute,
      path: ":id",
      render: ({ params }) => {
        const span = document.createElement("span");
        span.className = "cat-detail";
        createRenderEffect(
          () => params().id,
          (id) => {
            runs++;
            span.textContent = id ?? "";
          },
        );
        return span;
      },
    });
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/about",
      render: () => "about",
    });
    const routeTree = rootRoute.addChildren([catsRoute.addChildren([catDetailRoute]), aboutRoute]);
    const router = createRouter({ routeTree, basepath: "/" });
    router.mount(document.body);
    await tick();
    await tick();

    router.navigate("/cats/b" as never);
    await tick();
    await tick();
    expect(document.body.querySelector(".cat-detail")?.textContent).toBe("b");

    router.navigate("/about" as never);
    await tick();
    await tick();
    expect(document.body.querySelector(".cat-detail")).toBeNull();
    const before = runs;

    router.navigate("/about?x=1" as never);
    await tick();
    router.navigate("/about?x=2" as never);
    await tick();
    expect(runs).toBe(before);

    // Re-entry: exactly one live effect, not one per visit.
    router.navigate("/cats/c" as never);
    await tick();
    await tick();
    expect(document.body.querySelector(".cat-detail")?.textContent).toBe("c");
    const afterEnter = runs;
    router.navigate("/cats/d" as never);
    await tick();
    await tick();
    expect(document.body.querySelector(".cat-detail")?.textContent).toBe("d");
    expect(runs - afterEnter).toBe(1);
  });
});
