import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemo, createRenderEffect, createRoot } from "@solidjs/signals";
import "./index.ts";
import type { MeowRouter } from "./router-element.ts";
import { mountRouter, setURL, tick } from "./test-helpers.ts";

const mount = (html = ""): MeowRouter => mountRouter(html);

function pathOf(href: string): string {
  return new URL(href, window.location.origin).pathname;
}

function popstateAs(id: number, path: string): void {
  const wrapped = { __meowterHistoryId: id, user: null };
  window.history.replaceState(wrapped, "", path);
  window.dispatchEvent(new PopStateEvent("popstate", { state: wrapped }));
}

describe("router.searchParams (derived store)", () => {
  beforeEach(() => {
    setURL("/");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("reflects current URL search params on mount", async () => {
    setURL("/?filter=cats&sort=asc");
    const router = mount();
    await tick();
    expect(router.searchParams).toEqual({ filter: ["cats"], sort: ["asc"] });
  });

  it("collects multi-value keys into arrays", async () => {
    setURL("/?tag=a&tag=b&tag=c");
    const router = mount();
    await tick();
    expect(router.searchParams.tag).toEqual(["a", "b", "c"]);
  });

  it("setSearchParam(key, value) replaces all values for that key (default: replace)", async () => {
    setURL("/?filter=dogs");
    const router = mount();
    await tick();
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const pushSpy = vi.spyOn(window.history, "pushState");

    router.setSearchParam("filter", "cats");

    expect(router.searchParams.filter).toEqual(["cats"]);
    expect(replaceSpy).toHaveBeenCalledOnce();
    expect(pushSpy).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?filter=cats");
  });

  it("setSearchParam(key, [a, b]) writes multi-value", async () => {
    const router = mount();
    await tick();
    router.setSearchParam("tag", ["a", "b"]);
    expect(router.searchParams.tag).toEqual(["a", "b"]);
    expect(window.location.search).toBe("?tag=a&tag=b");
  });

  it("setSearchParam(key, null) removes the key", async () => {
    setURL("/?filter=cats");
    const router = mount();
    await tick();
    router.setSearchParam("filter", null);
    expect(router.searchParams.filter).toBeUndefined();
    expect(window.location.search).toBe("");
  });

  it("setSearchParam history='push' creates a real history entry", async () => {
    const router = mount();
    await tick();
    const pushSpy = vi.spyOn(window.history, "pushState");
    router.setSearchParam("filter", "cats", { history: "push" });
    expect(pushSpy).toHaveBeenCalledOnce();
  });

  it("a memo over a single key only re-runs when that key changes", async () => {
    setURL("/?filter=cats&sort=asc");
    const router = mount();
    await tick();

    const filterRuns: string[] = [];
    const sortRuns: string[] = [];
    const dispose = createRoot((d) => {
      const filter = createMemo(() => router.searchParams.filter?.[0] ?? "");
      const sort = createMemo(() => router.searchParams.sort?.[0] ?? "");
      createRenderEffect(
        () => filter(),
        (v) => {
          filterRuns.push(v);
        },
      );
      createRenderEffect(
        () => sort(),
        (v) => {
          sortRuns.push(v);
        },
      );
      return d;
    });

    expect(filterRuns).toEqual(["cats"]);
    expect(sortRuns).toEqual(["asc"]);

    router.setSearchParam("filter", "dogs");
    expect(filterRuns).toEqual(["cats", "dogs"]);
    expect(sortRuns).toEqual(["asc"]);

    router.setSearchParam("sort", "desc");
    expect(filterRuns).toEqual(["cats", "dogs"]);
    expect(sortRuns).toEqual(["asc", "desc"]);

    dispose();
  });

  it("does not invalidate route selection when only the query changes", async () => {
    setURL("/cats");
    const router = mount(`
      <meow-outlet>
        <meow-route path="/cats">cats</meow-route>
        <meow-route path="/dogs">dogs</meow-route>
      </meow-outlet>
    `);
    await tick();

    const cats = router.querySelector<HTMLElement>("meow-route[path='/cats']")!;
    let activations = 0;
    cats.addEventListener("route-match", () => {
      activations++;
    });

    router.setSearchParam("filter", "siamese");
    router.setSearchParam("filter", "tabby");

    expect(activations).toBe(0);
    expect(cats.hidden).toBe(false);
  });
});

describe("router.replace()", () => {
  beforeEach(() => {
    setURL("/");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("uses replaceState rather than pushState", () => {
    const router = mount();
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    router.replace("/foo");
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/foo");
  });

  it("emits route-change", () => {
    const router = mount();
    const events: URL[] = [];
    router.addEventListener("route-change", (e) => events.push(e.detail.url));
    router.replace("/foo");
    expect(events).toHaveLength(1);
    expect(events[0]!.pathname).toBe("/foo");
  });
});

describe("router.history (reactive store)", () => {
  beforeEach(() => {
    setURL("/");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("seeds with the current location as a single entry", async () => {
    setURL("/cats");
    const router = mount();
    await tick();
    expect(router.history.entries).toHaveLength(1);
    expect(pathOf(router.history.entries[0]!.href)).toBe("/cats");
    expect(router.history.index).toBe(0);
  });

  it("appends entries on navigate and advances the index", () => {
    const router = mount();
    router.navigate("/a");
    router.navigate("/b");
    router.navigate("/c");

    expect(router.history.entries.map((e) => pathOf(e.href))).toEqual([
      "/",
      "/a",
      "/b",
      "/c",
    ]);
    expect(router.history.index).toBe(3);
  });

  it("replace() overwrites the current entry without changing the index", () => {
    const router = mount();
    router.navigate("/a");
    router.navigate("/b");
    expect(router.history.index).toBe(2);

    router.replace("/b-prime");
    expect(router.history.index).toBe(2);
    expect(pathOf(router.history.entries[2]!.href)).toBe("/b-prime");
    expect(router.history.entries).toHaveLength(3);
  });

  it("popstate moves the index back to the matching entry", () => {
    const router = mount();
    router.navigate("/a");
    router.navigate("/b");
    expect(router.history.index).toBe(2);

    popstateAs(router.history.entries[0]!.id, "/");

    expect(router.history.index).toBe(0);
    expect(router.history.entries).toHaveLength(3);
  });

  it("forward navigation after going back truncates the forward stack", () => {
    const router = mount();
    router.navigate("/a");
    router.navigate("/b");

    popstateAs(router.history.entries[0]!.id, "/");
    expect(router.history.index).toBe(0);

    router.navigate("/c");
    expect(router.history.entries.map((e) => pathOf(e.href))).toEqual([
      "/",
      "/c",
    ]);
    expect(router.history.index).toBe(1);
  });

  it("currentState() still surfaces user state, not the wrapped form", () => {
    const router = mount();
    router.navigate("/a", { from: "test" });
    expect(router.currentState()).toEqual({ from: "test" });

    const wrapped = window.history.state as { user: unknown };
    expect(wrapped.user).toEqual({ from: "test" });
  });

  it("popstate to an entry not authored by the router synthesizes a fresh stack", () => {
    const router = mount();
    router.navigate("/a");
    router.navigate("/b");

    window.history.replaceState({ external: true }, "", "/external");
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: { external: true } }),
    );

    expect(router.history.entries).toHaveLength(1);
    expect(pathOf(router.history.entries[0]!.href)).toBe("/external");
    expect(router.currentState()).toEqual({ external: true });
  });
});
