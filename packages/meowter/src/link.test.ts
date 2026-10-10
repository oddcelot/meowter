import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "./index.ts";
import { createRootRoute, createRoute, createRouter } from "./create-route.ts";
import { createLink, MeowLink } from "./link.ts";
import { setURL, tick } from "./test-helpers.ts";

beforeEach(() => {
  setURL("/");
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

function buildRouter() {
  const rootRoute = createRootRoute();
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "",
  });
  const catsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cats",
  });
  const catDetailRoute = createRoute({
    getParentRoute: () => catsRoute,
    path: ":id",
  });
  const routeTree = rootRoute.addChildren([homeRoute, catsRoute.addChildren([catDetailRoute])]);
  const router = createRouter({ routeTree, basepath: "/" });
  router.mount(document.body);
  return { router, homeRoute, catsRoute, catDetailRoute };
}

describe("router.navigate / replace with options", () => {
  it("navigates via a typed Route reference with interpolated params", async () => {
    const { router, catDetailRoute } = buildRouter();
    await tick();

    router.navigate({ to: catDetailRoute, params: { id: "whiskers" } });
    await tick();

    expect(window.location.pathname).toBe("/cats/whiskers");
  });

  it("appends search and hash from options", async () => {
    const { router, catDetailRoute } = buildRouter();
    await tick();

    router.navigate({
      to: catDetailRoute,
      params: { id: "biscuit" },
      search: { tab: "info", tag: ["a", "b"] },
      hash: "section-1",
    });
    await tick();

    expect(window.location.pathname).toBe("/cats/biscuit");
    expect(window.location.search).toBe("?tab=info&tag=a&tag=b");
    expect(window.location.hash).toBe("#section-1");
  });

  it("honors replace: true to swap the current history entry", async () => {
    const { router, catDetailRoute } = buildRouter();
    await tick();
    const before = window.history.length;

    router.navigate({
      to: catDetailRoute,
      params: { id: "mittens" },
      replace: true,
    });
    await tick();

    expect(window.location.pathname).toBe("/cats/mittens");
    expect(window.history.length).toBe(before); // not pushed
  });

  it("throws on missing params at runtime", async () => {
    const { router, catDetailRoute } = buildRouter();
    await tick();

    expect(() =>
      router.navigate({
        // intentionally missing `id`
        to: catDetailRoute,
        params: {} as never,
      }),
    ).toThrow(/missing param "id"/);
  });

  it("string overload still works", async () => {
    const { router } = buildRouter();
    await tick();

    router.navigate("/cats");
    await tick();

    expect(window.location.pathname).toBe("/cats");
  });

  it("buildHref returns the same href as navigate would use", () => {
    const { router, catDetailRoute } = buildRouter();
    const href = router.buildHref({
      to: catDetailRoute,
      params: { id: "whiskers" },
      search: { q: "1" },
    });
    expect(href).toBe("/cats/whiskers?q=1");
  });
});

describe("createLink helper", () => {
  it("returns an href and onClick that intercepts plain left-click", async () => {
    const { router, catDetailRoute } = buildRouter();
    await tick();

    const link = createLink(router, {
      to: catDetailRoute,
      params: { id: "whiskers" },
    });

    expect(link.href).toBe("/cats/whiskers");

    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    link.onClick(event);
    await tick();

    expect(event.defaultPrevented).toBe(true);
    expect(window.location.pathname).toBe("/cats/whiskers");
  });

  it("does NOT intercept cmd/ctrl/shift/alt clicks", async () => {
    const { router, catDetailRoute } = buildRouter();
    await tick();

    const link = createLink(router, {
      to: catDetailRoute,
      params: { id: "biscuit" },
    });

    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true,
    });
    link.onClick(event);

    expect(event.defaultPrevented).toBe(false);
    // location unchanged
    expect(window.location.pathname).toBe("/");
  });

  it("isActive flips with router navigation", async () => {
    const { router, catsRoute } = buildRouter();
    await tick();

    const link = createLink(router, { to: catsRoute });
    expect(link.isActive()).toBe(false);

    router.navigate("/cats");
    await tick();
    expect(link.isActive()).toBe(true);

    router.navigate("/");
    await tick();
    expect(link.isActive()).toBe(false);
  });
});

describe("<meow-link> custom element", () => {
  function appendLinkInsideRouter(): MeowLink {
    const link = document.createElement("meow-link") as MeowLink;
    const routerEl = document.body.querySelector("meow-router")!;
    routerEl.appendChild(link);
    return link;
  }

  it("renders an <a> with the computed href from a string `to` attribute", async () => {
    buildRouter();
    await tick();

    const link = appendLinkInsideRouter();
    link.setAttribute("to", "/cats");

    const anchor = link.querySelector("a");
    expect(anchor).toBeTruthy();
    expect(anchor!.getAttribute("href")).toBe("/cats");
  });

  it("interpolates params when `to` is set as a Route value", async () => {
    const { catDetailRoute } = buildRouter();
    await tick();

    const link = appendLinkInsideRouter();
    link.to = catDetailRoute;
    link.params = { id: "mittens" };

    const anchor = link.querySelector("a");
    expect(anchor!.getAttribute("href")).toBe("/cats/mittens");
  });

  it("toggles aria-current=page on route changes", async () => {
    const { router } = buildRouter();
    await tick();

    const link = appendLinkInsideRouter();
    link.setAttribute("to", "/cats");
    await tick();

    const anchor = link.querySelector("a")!;
    expect(anchor.hasAttribute("aria-current")).toBe(false);

    router.navigate("/cats");
    await tick();
    expect(anchor.getAttribute("aria-current")).toBe("page");
    expect(anchor.getAttribute("data-status")).toBe("active");

    router.navigate("/");
    await tick();
    expect(anchor.hasAttribute("aria-current")).toBe(false);
  });
});

describe("links under a basepath", () => {
  function buildBasepathRouter() {
    const rootRoute = createRootRoute();
    const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "" });
    const catsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/cats" });
    const routeTree = rootRoute.addChildren([homeRoute, catsRoute]);
    const router = createRouter({ routeTree, basepath: "/x/" });
    router.mount(document.body);
    return { router, catsRoute };
  }

  function appendLink(attrs: Record<string, string>): HTMLAnchorElement {
    const link = document.createElement("meow-link") as MeowLink;
    for (const [k, v] of Object.entries(attrs)) link.setAttribute(k, v);
    document.body.querySelector("meow-router")!.appendChild(link);
    return link.querySelector("a")!;
  }

  const click = (el: Element) =>
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));

  beforeEach(() => setURL("/x/"));

  it("createLink href includes the basepath", async () => {
    const { router, catsRoute } = buildBasepathRouter();
    await tick();
    expect(createLink(router, { to: catsRoute }).href).toBe("/x/cats");
  });

  it("createLink isActive tracks the basepath-stripped URL", async () => {
    const { router, catsRoute } = buildBasepathRouter();
    await tick();
    const link = createLink(router, { to: catsRoute });
    expect(link.isActive()).toBe(false);

    router.navigate("/cats");
    await tick();
    expect(window.location.pathname).toBe("/x/cats");
    expect(link.isActive()).toBe(true);

    router.navigate("/");
    await tick();
    expect(link.isActive()).toBe(false);
  });

  it("<meow-link> renders a prefixed href", async () => {
    buildBasepathRouter();
    await tick();
    const anchor = appendLink({ to: "/cats" });
    expect(anchor.getAttribute("href")).toBe("/x/cats");
  });

  it("<meow-link> toggles aria-current under a basepath", async () => {
    const { router } = buildBasepathRouter();
    await tick();
    const anchor = appendLink({ to: "/cats" });
    expect(anchor.hasAttribute("aria-current")).toBe(false);

    router.navigate("/cats");
    await tick();
    expect(anchor.getAttribute("aria-current")).toBe("page");

    router.navigate("/");
    await tick();
    expect(anchor.hasAttribute("aria-current")).toBe(false);
  });

  it("<meow-link exact to='/'> is active at the basepath root", async () => {
    buildBasepathRouter();
    await tick();
    const anchor = appendLink({ to: "/", exact: "" });
    expect(anchor.getAttribute("aria-current")).toBe("page");
  });

  it("clicking a <meow-link> does not double-prefix the basepath", async () => {
    buildBasepathRouter();
    await tick();
    const anchor = appendLink({ to: "/cats" });
    click(anchor);
    await tick();
    expect(window.location.pathname).toBe("/x/cats");
  });

  it("clicking a replace <meow-link> does not double-prefix the basepath", async () => {
    buildBasepathRouter();
    await tick();
    const anchor = appendLink({ to: "/cats", replace: "" });
    click(anchor);
    await tick();
    expect(window.location.pathname).toBe("/x/cats");
  });
});
