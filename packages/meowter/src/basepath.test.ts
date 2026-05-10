import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./router-element.ts";
import { normalizeBasepath } from "./router-element.ts";
import {
  expectPushedPath,
  lastPushedURL,
  mountRouter,
  setURL,
  spyPushState,
  spyReplaceState,
} from "./test-helpers.ts";

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
    const router = mountRouter("", 'basepath="/x/"');
    expect(router.basepath).toBe("/x/");
  });

  it("normalizes basepath set via attribute", () => {
    const router = mountRouter("", 'basepath="meowter"');
    expect(router.basepath).toBe("/meowter/");
  });

  it("accepts property set after registration", () => {
    const router = mountRouter();
    router.basepath = "/x/";
    expect(router.basepath).toBe("/x/");
  });

  it("matchURL strips basepath from pathname", () => {
    setURL("/x/cats");
    const router = mountRouter("", 'basepath="/x/"');
    expect(router.matchURL().pathname).toBe("/cats");
  });

  it("matchURL handles basepath without trailing slash in URL", () => {
    setURL("/x");
    const router = mountRouter("", 'basepath="/x/"');
    expect(router.matchURL().pathname).toBe("/");
  });

  it("matchURL leaves off-base URLs unchanged", () => {
    setURL("/wrong");
    const router = mountRouter("", 'basepath="/x/"');
    expect(router.matchURL().pathname).toBe("/wrong");
  });

  it("matchURL is identity when basepath is '/'", () => {
    setURL("/cats");
    const router = mountRouter();
    expect(router.matchURL().pathname).toBe("/cats");
    expect(router.matchURL().href).toBe(router.currentURL().href);
  });

  it("navigate('/cats') writes /x/cats to location", () => {
    const router = mountRouter("", 'basepath="/x/"');
    const pushSpy = spyPushState();
    router.navigate("/cats");
    expect(pushSpy).toHaveBeenCalledOnce();
    expectPushedPath(pushSpy, "/x/cats");
  });

  it("navigate('/x/cats') does not double-prefix", () => {
    const router = mountRouter("", 'basepath="/x/"');
    const pushSpy = spyPushState();
    router.navigate("/x/cats");
    expectPushedPath(pushSpy, "/x/cats");
  });

  it("navigate('/x') (no trailing slash) does not double-prefix", () => {
    const router = mountRouter("", 'basepath="/x/"');
    const pushSpy = spyPushState();
    router.navigate("/x");
    expectPushedPath(pushSpy, "/x");
  });

  it("navigate does not double-prefix same-origin full URL", () => {
    const router = mountRouter("", 'basepath="/x/"');
    const pushSpy = spyPushState();
    router.navigate(`${window.location.origin}/x/cats`);
    expectPushedPath(pushSpy, "/x/cats");
  });

  it("navigate prepends basepath for same-origin URL on root path", () => {
    const router = mountRouter("", 'basepath="/x/"');
    const pushSpy = spyPushState();
    router.navigate(`${window.location.origin}/cats`);
    expectPushedPath(pushSpy, "/x/cats");
  });

  it("navigate leaves hash-only paths on current pathname", () => {
    setURL("/x/cats");
    const router = mountRouter("", 'basepath="/x/"');
    const pushSpy = spyPushState();
    router.navigate("#anchor");
    if (pushSpy.mock.calls.length > 0) {
      const u = lastPushedURL(pushSpy);
      expect(u.pathname).toBe("/x/cats");
      expect(u.hash).toBe("#anchor");
    }
  });

  it("navigate leaves search-only paths on current pathname", () => {
    setURL("/x/cats");
    const router = mountRouter("", 'basepath="/x/"');
    const pushSpy = spyPushState();
    router.navigate("?q=1");
    const u = lastPushedURL(pushSpy);
    expect(u.pathname).toBe("/x/cats");
    expect(u.search).toBe("?q=1");
  });

  it("navigate resolves relative paths against current URL", () => {
    setURL("/x/cats/whiskers/");
    const router = mountRouter("", 'basepath="/x/"');
    const pushSpy = spyPushState();
    router.navigate("../mittens");
    expectPushedPath(pushSpy, "/x/cats/mittens");
  });

  it("basepath='/' is no-op for navigate", () => {
    const router = mountRouter();
    const pushSpy = spyPushState();
    router.navigate("/cats");
    expectPushedPath(pushSpy, "/cats");
  });

  it("setSearchParam does not double-prefix", () => {
    setURL("/x/cats");
    const router = mountRouter("", 'basepath="/x/"');
    const replaceSpy = spyReplaceState();
    router.setSearchParam("filter", "tabby");
    const parsed = lastPushedURL(replaceSpy);
    expect(parsed.pathname).toBe("/x/cats");
    expect(parsed.searchParams.get("filter")).toBe("tabby");
  });

  it("replace prepends basepath", () => {
    const router = mountRouter("", 'basepath="/x/"');
    const replaceSpy = spyReplaceState();
    router.replace("/cats");
    expectPushedPath(replaceSpy, "/x/cats");
  });

  it("intercepted anchor click writes prefixed URL", () => {
    const router = mountRouter('<a href="/cats" id="lnk">Cats</a>', 'basepath="/x/"');
    const pushSpy = spyPushState();
    const anchor = router.querySelector<HTMLAnchorElement>("#lnk")!;
    anchor.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
    expect(pushSpy).toHaveBeenCalledOnce();
    expectPushedPath(pushSpy, "/x/cats");
  });
});
