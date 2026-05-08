import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./router-element.ts";
import type { MeowRouter } from "./router-element.ts";
import type { RouteChangeDetail } from "./events.ts";

function clickEvent(extra: MouseEventInit = {}): MouseEvent {
  return new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    ...extra,
  });
}

function mountRouter(innerHTML: string): MeowRouter {
  const router = document.createElement("meow-router");
  router.innerHTML = innerHTML;
  document.body.append(router);
  return router;
}

function captureRoute(router: MeowRouter): {
  events: CustomEvent<RouteChangeDetail>[];
} {
  const events: CustomEvent<RouteChangeDetail>[] = [];
  router.addEventListener("route-change", (e) => events.push(e));
  return { events };
}

describe("MeowRouter", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("intercepts internal anchor clicks and pushes history", () => {
    const router = mountRouter('<a href="/foo" id="lnk">Foo</a>');
    const { events } = captureRoute(router);
    const pushSpy = vi.spyOn(window.history, "pushState");

    const anchor = router.querySelector<HTMLAnchorElement>("#lnk")!;
    const event = clickEvent();
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(pushSpy).toHaveBeenCalledOnce();
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.url.pathname).toBe("/foo");
  });

  it("ignores clicks with modifier keys", () => {
    const router = mountRouter('<a href="/foo" id="lnk">Foo</a>');
    const { events } = captureRoute(router);
    const pushSpy = vi.spyOn(window.history, "pushState");

    const anchor = router.querySelector<HTMLAnchorElement>("#lnk")!;
    const event = clickEvent({ metaKey: true });
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(pushSpy).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it("ignores external origin links", () => {
    const router = mountRouter('<a href="https://example.com/x" id="lnk">Ext</a>');
    const { events } = captureRoute(router);
    const pushSpy = vi.spyOn(window.history, "pushState");

    const anchor = router.querySelector<HTMLAnchorElement>("#lnk")!;
    const event = clickEvent();
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(pushSpy).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it("ignores anchors with target other than _self", () => {
    const router = mountRouter('<a href="/x" target="_blank" id="lnk">New</a>');
    const { events } = captureRoute(router);
    const pushSpy = vi.spyOn(window.history, "pushState");

    const anchor = router.querySelector<HTMLAnchorElement>("#lnk")!;
    const event = clickEvent();
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(pushSpy).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it("ignores download anchors", () => {
    const router = mountRouter('<a href="/x" download id="lnk">DL</a>');
    const { events } = captureRoute(router);
    const pushSpy = vi.spyOn(window.history, "pushState");

    const anchor = router.querySelector<HTMLAnchorElement>("#lnk")!;
    const event = clickEvent();
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(pushSpy).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it("intercepts clicks on elements nested inside anchors", () => {
    const router = mountRouter('<a href="/foo" id="lnk"><span id="inner">Foo</span></a>');
    const { events } = captureRoute(router);
    const pushSpy = vi.spyOn(window.history, "pushState");

    const inner = router.querySelector<HTMLElement>("#inner")!;
    const event = clickEvent();
    inner.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(pushSpy).toHaveBeenCalledOnce();
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.url.pathname).toBe("/foo");
  });

  it("supports programmatic navigate()", () => {
    const router = mountRouter("");
    const { events } = captureRoute(router);
    const pushSpy = vi.spyOn(window.history, "pushState");

    router.navigate("/bar", { from: "test" });

    expect(pushSpy).toHaveBeenCalledOnce();
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.url.pathname).toBe("/bar");
    expect(events[0]!.detail.state).toEqual({ from: "test" });
  });

  it("does not push duplicate history entries for same URL", () => {
    const router = mountRouter("");
    const pushSpy = vi.spyOn(window.history, "pushState");

    router.navigate("/same");
    router.navigate("/same");

    expect(pushSpy).toHaveBeenCalledOnce();
  });

  it("emits route-change on popstate", () => {
    const router = mountRouter("");
    const { events } = captureRoute(router);

    window.history.pushState({ k: 1 }, "", "/popped");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { k: 1 } }));

    expect(events).toHaveLength(1);
    expect(events[0]!.detail.url.pathname).toBe("/popped");
    expect(events[0]!.detail.state).toEqual({ k: 1 });
  });
});
