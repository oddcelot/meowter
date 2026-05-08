import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { shouldInterceptLinkClick } from "./link-intercept.ts";

function clickEvent(extra: MouseEventInit = {}): MouseEvent {
  return new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    ...extra,
  });
}

function intercept(target: Element, ev: MouseEvent): URL | null {
  let result: URL | null = null;
  const handler = (e: Event): void => {
    result = shouldInterceptLinkClick(e as MouseEvent);
    if (result) e.preventDefault();
  };
  document.addEventListener("click", handler, { capture: true });
  target.dispatchEvent(ev);
  document.removeEventListener("click", handler, { capture: true });
  return result;
}

describe("shouldInterceptLinkClick", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns the resolved URL for a plain internal anchor", () => {
    const a = document.createElement("a");
    a.href = "/foo";
    document.body.append(a);
    const url = intercept(a, clickEvent());
    expect(url).not.toBeNull();
    expect(url!.pathname).toBe("/foo");
  });

  it("returns null when a modifier key is held", () => {
    const a = document.createElement("a");
    a.href = "/foo";
    document.body.append(a);
    expect(intercept(a, clickEvent({ metaKey: true }))).toBeNull();
    expect(intercept(a, clickEvent({ ctrlKey: true }))).toBeNull();
    expect(intercept(a, clickEvent({ shiftKey: true }))).toBeNull();
    expect(intercept(a, clickEvent({ altKey: true }))).toBeNull();
  });

  it("returns null for a non-primary mouse button", () => {
    const a = document.createElement("a");
    a.href = "/foo";
    document.body.append(a);
    expect(intercept(a, clickEvent({ button: 1 }))).toBeNull();
  });

  it("returns null for an external origin", () => {
    const a = document.createElement("a");
    a.href = "https://example.com/x";
    document.body.append(a);
    expect(intercept(a, clickEvent())).toBeNull();
  });

  it("returns null for target=_blank, but allows target=_self", () => {
    const blank = document.createElement("a");
    blank.href = "/x";
    blank.target = "_blank";
    document.body.append(blank);
    expect(intercept(blank, clickEvent())).toBeNull();

    const self = document.createElement("a");
    self.href = "/x";
    self.target = "_self";
    document.body.append(self);
    expect(intercept(self, clickEvent())?.pathname).toBe("/x");
  });

  it("returns null for download anchors", () => {
    const a = document.createElement("a");
    a.href = "/x";
    a.setAttribute("download", "");
    document.body.append(a);
    expect(intercept(a, clickEvent())).toBeNull();
  });

  it("returns null when rel includes 'external'", () => {
    const a = document.createElement("a");
    a.href = "/x";
    a.rel = "noopener external";
    document.body.append(a);
    expect(intercept(a, clickEvent())).toBeNull();
  });

  it("returns null when there is no anchor in the click target's ancestry", () => {
    const div = document.createElement("div");
    document.body.append(div);
    expect(intercept(div, clickEvent())).toBeNull();
  });

  it("returns null when the event is already defaultPrevented", () => {
    const a = document.createElement("a");
    a.href = "/foo";
    document.body.append(a);
    const ev = clickEvent();
    ev.preventDefault();
    expect(intercept(a, ev)).toBeNull();
  });
});
