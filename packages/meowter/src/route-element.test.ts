import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "./route-element.ts";
import type { MeowRoute } from "./route-element.ts";
import type { RouteMatchDetail, RouteLeaveDetail } from "./events.ts";

function mount(path: string): MeowRoute {
  const route = document.createElement("meow-route");
  route.setAttribute("path", path);
  document.body.append(route);
  return route;
}

describe("MeowRoute", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("starts hidden when connected", () => {
    const route = mount("/foo");
    expect(route.hidden).toBe(true);
    expect(route.matched).toBe(false);
  });

  it("activate() toggles hidden, sets params, fires route-match exactly once", () => {
    const route = mount("/cats/:id");
    const matches: RouteMatchDetail[] = [];
    route.addEventListener("route-match", (e) => matches.push(e.detail));

    route.activate({ id: "whiskers" }, "/cats/whiskers");
    expect(route.hidden).toBe(false);
    expect(route.matched).toBe(true);
    expect(route.params).toEqual({ id: "whiskers" });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.params).toEqual({ id: "whiskers" });
    expect(matches[0]!.consumed).toBe("/cats/whiskers");

    route.activate({ id: "mittens" }, "/cats/mittens");
    expect(matches).toHaveLength(1);
    expect(route.params).toEqual({ id: "mittens" });
  });

  it("deactivate() hides, clears params, fires route-leave exactly once", () => {
    const route = mount("/foo");
    const leaves: RouteLeaveDetail[] = [];
    route.addEventListener("route-leave", (e) => leaves.push(e.detail));

    route.activate({}, "/foo");
    route.deactivate();
    expect(route.hidden).toBe(true);
    expect(route.matched).toBe(false);
    expect(route.params).toBeNull();
    expect(leaves).toHaveLength(1);

    route.deactivate();
    expect(leaves).toHaveLength(1);
  });

  it("compiledPath reflects updated path attribute", () => {
    const route = mount("/foo");
    expect(route.compiledPath.exact.test("/foo")).toBe(true);
    route.setAttribute("path", "/bar");
    expect(route.compiledPath.exact.test("/bar")).toBe(true);
    expect(route.compiledPath.exact.test("/foo")).toBe(false);
  });
});
