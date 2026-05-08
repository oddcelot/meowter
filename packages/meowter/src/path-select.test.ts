import { describe, expect, it } from "vitest";
import { compilePath } from "./path-compile.ts";
import { computeRemainder, selectFor, type RouteCandidate } from "./path-select.ts";

function candidate(path: string, hasNestedOutlet = false): RouteCandidate & { path: string } {
  return { path, compiledPath: compilePath(path), hasNestedOutlet };
}

describe("selectFor", () => {
  it("picks an exact static match", () => {
    const routes = [candidate("/cats"), candidate("/dogs")];
    const r = selectFor("/dogs", routes);
    expect(r?.route.path).toBe("/dogs");
    expect(r?.consumed).toBe("/dogs");
    expect(r?.params).toEqual({});
  });

  it("returns null when nothing matches and no fallback", () => {
    const routes = [candidate("/cats")];
    expect(selectFor("/zzz", routes)).toBeNull();
  });

  it("captures :params on exact match", () => {
    const routes = [candidate("/cats/:id")];
    const r = selectFor("/cats/whiskers", routes);
    expect(r?.params).toEqual({ id: "whiskers" });
    expect(r?.consumed).toBe("/cats/whiskers");
  });

  it("uses prefix match only when route has a nested outlet", () => {
    const withOutlet = candidate("/cats", true);
    const r = selectFor("/cats/whiskers", [withOutlet]);
    expect(r?.route).toBe(withOutlet);
    expect(r?.consumed).toBe("/cats");

    const withoutOutlet = candidate("/cats", false);
    expect(selectFor("/cats/whiskers", [withoutOutlet])).toBeNull();
  });

  it("matches index path when input is empty or '/'", () => {
    const routes = [candidate(""), candidate("/cats")];
    expect(selectFor("", routes)?.route.path).toBe("");
    expect(selectFor("/", routes)?.route.path).toBe("");
  });

  it("falls back to '*' only if nothing else matched", () => {
    const routes = [candidate("/cats"), candidate("*")];
    expect(selectFor("/cats", routes)?.route.path).toBe("/cats");
    expect(selectFor("/garbage", routes)?.route.path).toBe("*");
  });

  it("respects document order — first match wins among siblings", () => {
    const routes = [candidate("/cats/new"), candidate("/cats/:id")];
    expect(selectFor("/cats/new", routes)?.route.path).toBe("/cats/new");
    expect(selectFor("/cats/whiskers", routes)?.route.path).toBe("/cats/:id");
  });
});

describe("computeRemainder", () => {
  it("subtracts the consumed prefix and re-adds a leading slash", () => {
    expect(computeRemainder("/cats/whiskers", "/cats")).toBe("/whiskers");
  });

  it("returns empty when input was fully consumed", () => {
    expect(computeRemainder("/cats", "/cats")).toBe("");
    expect(computeRemainder("/", "/")).toBe("");
  });

  it("returns empty when consumed is not a prefix of input", () => {
    expect(computeRemainder("/cats", "/dogs")).toBe("");
  });
});
