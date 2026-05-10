import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./router-element.ts";
import {
  captureRouteEvents,
  dispatchAnchorClick,
  expectIntercepted,
  expectNotIntercepted,
  mountRouter,
  setURL,
  spyPushState,
} from "./test-helpers.ts";

describe("MeowRouter", () => {
  beforeEach(() => {
    setURL("/");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("intercepts internal anchor clicks and pushes history", () => {
    const router = mountRouter('<a href="/foo" id="lnk">Foo</a>');
    const events = captureRouteEvents(router);
    const pushSpy = spyPushState();

    const event = dispatchAnchorClick(router, "#lnk");

    expectIntercepted(event, pushSpy, events, "/foo");
  });

  it("ignores clicks with modifier keys", () => {
    const router = mountRouter('<a href="/foo" id="lnk">Foo</a>');
    const events = captureRouteEvents(router);
    const pushSpy = spyPushState();

    const event = dispatchAnchorClick(router, "#lnk", { metaKey: true });

    expectNotIntercepted(event, pushSpy, events);
  });

  it("ignores external origin links", () => {
    const router = mountRouter('<a href="https://example.com/x" id="lnk">Ext</a>');
    const events = captureRouteEvents(router);
    const pushSpy = spyPushState();

    const event = dispatchAnchorClick(router, "#lnk");

    expectNotIntercepted(event, pushSpy, events);
  });

  it("ignores anchors with target other than _self", () => {
    const router = mountRouter('<a href="/x" target="_blank" id="lnk">New</a>');
    const events = captureRouteEvents(router);
    const pushSpy = spyPushState();

    const event = dispatchAnchorClick(router, "#lnk");

    expectNotIntercepted(event, pushSpy, events);
  });

  it("ignores download anchors", () => {
    const router = mountRouter('<a href="/x" download id="lnk">DL</a>');
    const events = captureRouteEvents(router);
    const pushSpy = spyPushState();

    const event = dispatchAnchorClick(router, "#lnk");

    expectNotIntercepted(event, pushSpy, events);
  });

  it("intercepts clicks on elements nested inside anchors", () => {
    const router = mountRouter('<a href="/foo" id="lnk"><span id="inner">Foo</span></a>');
    const events = captureRouteEvents(router);
    const pushSpy = spyPushState();

    const event = dispatchAnchorClick(router, "#inner");

    expectIntercepted(event, pushSpy, events, "/foo");
  });

  it("supports programmatic navigate()", () => {
    const router = mountRouter();
    const events = captureRouteEvents(router);
    const pushSpy = spyPushState();

    router.navigate("/bar", { from: "test" });

    expect(pushSpy).toHaveBeenCalledOnce();
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.url.pathname).toBe("/bar");
    expect(events[0]!.detail.state).toEqual({ from: "test" });
  });

  it("does not push duplicate history entries for same URL", () => {
    const router = mountRouter();
    const pushSpy = spyPushState();

    router.navigate("/same");
    router.navigate("/same");

    expect(pushSpy).toHaveBeenCalledOnce();
  });

  it("emits route-change on popstate", () => {
    const router = mountRouter();
    const events = captureRouteEvents(router);

    window.history.pushState({ k: 1 }, "", "/popped");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { k: 1 } }));

    expect(events).toHaveLength(1);
    expect(events[0]!.detail.url.pathname).toBe("/popped");
    expect(events[0]!.detail.state).toEqual({ k: 1 });
  });
});
