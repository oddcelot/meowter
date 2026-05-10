import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./router-element.ts";
import { MeowRouter, normalizeBasepath } from "./router-element.ts";

function setURL(path: string): void {
  window.history.replaceState(null, "", path);
}

function mountRouter(attrs: string = "", innerHTML: string = ""): MeowRouter {
  document.body.innerHTML = `<meow-router ${attrs}>${innerHTML}</meow-router>`;
  return document.body.firstElementChild as MeowRouter;
}

describe("normalizeBasepath", () => {
  it("returns '/' for empty/null/undefined/'/'", () => {
    expect(normalizeBasepath("")).toBe("/");
    expect(normalizeBasepath(null)).toBe("/");
    expect(normalizeBasepath(undefined)).toBe("/");
    expect(normalizeBasepath("/")).toBe("/");
    expect(normalizeBasepath("   ")).toBe("/");
  });

  it("adds leading and trailing slash", () => {
    expect(normalizeBasepath("meowter")).toBe("/meowter/");
    expect(normalizeBasepath("/meowter")).toBe("/meowter/");
    expect(normalizeBasepath("meowter/")).toBe("/meowter/");
    expect(normalizeBasepath("/meowter/")).toBe("/meowter/");
  });

  it("collapses duplicate slashes", () => {
    expect(normalizeBasepath("//meowter//")).toBe("/meowter/");
    expect(normalizeBasepath("/a//b/")).toBe("/a/b/");
  });
});

describe("MeowRouter basepath", () => {
  beforeEach(() => {
    setURL("/");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("defaults to '/' with no attribute or property", () => {
    const router = mountRouter();
    expect(router.basepath).toBe("/");
  });

  it("reads basepath attribute on connect", () => {
    const router = mountRouter('basepath="/x/"');
    expect(router.basepath).toBe("/x/");
  });

  it("normalizes basepath set via attribute", () => {
    const router = mountRouter('basepath="meowter"');
    expect(router.basepath).toBe("/meowter/");
  });

  it("accepts property set after registration", () => {
    const router = mountRouter();
    router.basepath = "/x/";
    expect(router.basepath).toBe("/x/");
  });

  it("matchURL strips basepath from pathname", () => {
    setURL("/x/cats");
    const router = mountRouter('basepath="/x/"');
    expect(router.matchURL().pathname).toBe("/cats");
  });

  it("matchURL handles basepath without trailing slash in URL", () => {
    setURL("/x");
    const router = mountRouter('basepath="/x/"');
    expect(router.matchURL().pathname).toBe("/");
  });

  it("matchURL leaves off-base URLs unchanged", () => {
    setURL("/wrong");
    const router = mountRouter('basepath="/x/"');
    expect(router.matchURL().pathname).toBe("/wrong");
  });

  it("matchURL is identity when basepath is '/'", () => {
    setURL("/cats");
    const router = mountRouter();
    expect(router.matchURL().pathname).toBe("/cats");
    expect(router.matchURL().href).toBe(router.currentURL().href);
  });

  it("navigate('/cats') writes /x/cats to location", () => {
    const router = mountRouter('basepath="/x/"');
    const pushSpy = vi.spyOn(window.history, "pushState");
    router.navigate("/cats");
    expect(pushSpy).toHaveBeenCalledOnce();
    const url = pushSpy.mock.calls[0]![2] as string;
    expect(new URL(url, window.location.origin).pathname).toBe("/x/cats");
  });

  it("navigate('/x/cats') does not double-prefix", () => {
    const router = mountRouter('basepath="/x/"');
    const pushSpy = vi.spyOn(window.history, "pushState");
    router.navigate("/x/cats");
    const url = pushSpy.mock.calls[0]![2] as string;
    expect(new URL(url, window.location.origin).pathname).toBe("/x/cats");
  });

  it("navigate('/x') (no trailing slash) does not double-prefix", () => {
    const router = mountRouter('basepath="/x/"');
    const pushSpy = vi.spyOn(window.history, "pushState");
    router.navigate("/x");
    const url = pushSpy.mock.calls[0]![2] as string;
    expect(new URL(url, window.location.origin).pathname).toBe("/x");
  });

  it("navigate does not double-prefix same-origin full URL", () => {
    const router = mountRouter('basepath="/x/"');
    const pushSpy = vi.spyOn(window.history, "pushState");
    const target = `${window.location.origin}/x/cats`;
    router.navigate(target);
    const url = pushSpy.mock.calls[0]![2] as string;
    expect(new URL(url, window.location.origin).pathname).toBe("/x/cats");
  });

  it("navigate prepends basepath for same-origin URL on root path", () => {
    const router = mountRouter('basepath="/x/"');
    const pushSpy = vi.spyOn(window.history, "pushState");
    const target = `${window.location.origin}/cats`;
    router.navigate(target);
    const url = pushSpy.mock.calls[0]![2] as string;
    expect(new URL(url, window.location.origin).pathname).toBe("/x/cats");
  });

  it("navigate leaves hash-only paths on current pathname", () => {
    setURL("/x/cats");
    const router = mountRouter('basepath="/x/"');
    const pushSpy = vi.spyOn(window.history, "pushState");
    router.navigate("#anchor");
    const url = pushSpy.mock.calls[0]?.[2] as string | undefined;
    if (url) {
      const u = new URL(url, window.location.origin);
      expect(u.pathname).toBe("/x/cats");
      expect(u.hash).toBe("#anchor");
    }
  });

  it("navigate leaves search-only paths on current pathname", () => {
    setURL("/x/cats");
    const router = mountRouter('basepath="/x/"');
    const pushSpy = vi.spyOn(window.history, "pushState");
    router.navigate("?q=1");
    const url = pushSpy.mock.calls[0]?.[2] as string | undefined;
    expect(url).toBeDefined();
    const u = new URL(url!, window.location.origin);
    expect(u.pathname).toBe("/x/cats");
    expect(u.search).toBe("?q=1");
  });

  it("navigate resolves relative paths against current URL", () => {
    setURL("/x/cats/whiskers/");
    const router = mountRouter('basepath="/x/"');
    const pushSpy = vi.spyOn(window.history, "pushState");
    router.navigate("../mittens");
    const url = pushSpy.mock.calls[0]![2] as string;
    expect(new URL(url, window.location.origin).pathname).toBe("/x/cats/mittens");
  });

  it("basepath='/' is no-op for navigate", () => {
    const router = mountRouter();
    const pushSpy = vi.spyOn(window.history, "pushState");
    router.navigate("/cats");
    const url = pushSpy.mock.calls[0]![2] as string;
    expect(new URL(url, window.location.origin).pathname).toBe("/cats");
  });

  it("setSearchParam does not double-prefix", () => {
    setURL("/x/cats");
    const router = mountRouter('basepath="/x/"');
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    router.setSearchParam("filter", "tabby");
    const url = replaceSpy.mock.calls.at(-1)![2] as string;
    const parsed = new URL(url, window.location.origin);
    expect(parsed.pathname).toBe("/x/cats");
    expect(parsed.searchParams.get("filter")).toBe("tabby");
  });

  it("replace prepends basepath", () => {
    const router = mountRouter('basepath="/x/"');
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    router.replace("/cats");
    const url = replaceSpy.mock.calls.at(-1)![2] as string;
    expect(new URL(url, window.location.origin).pathname).toBe("/x/cats");
  });

  it("intercepted anchor click writes prefixed URL", () => {
    const router = mountRouter('basepath="/x/"', '<a href="/cats" id="lnk">Cats</a>');
    const pushSpy = vi.spyOn(window.history, "pushState");
    const anchor = router.querySelector<HTMLAnchorElement>("#lnk")!;
    anchor.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
    expect(pushSpy).toHaveBeenCalledOnce();
    const url = pushSpy.mock.calls[0]![2] as string;
    expect(new URL(url, window.location.origin).pathname).toBe("/x/cats");
  });
});
