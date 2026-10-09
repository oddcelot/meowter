import { describe, expect, it } from "vitest";
import { discoverFileRoutes, groupByParent } from "./extract-file-routes.ts";

describe("discoverFileRoutes", () => {
  it("translates each filename convention to the right path", () => {
    const routes = discoverFileRoutes([
      "__root.route.ts",
      "index.route.ts",
      "about.route.ts",
      "cats.route.ts",
      "cats.index.route.ts",
      "cats.new.route.ts",
      "cats.$id.route.ts",
      "$.route.ts",
      "cats.$.route.ts",
    ]);

    const byKey = Object.fromEntries(routes.map((r) => [r.key, r]));
    expect(byKey["__root"]?.fullPath).toBe("/");
    expect(byKey["index"]?.fullPath).toBe("/");
    expect(byKey["about"]?.fullPath).toBe("/about");
    expect(byKey["cats"]?.fullPath).toBe("/cats");
    expect(byKey["cats.index"]?.fullPath).toBe("/cats");
    expect(byKey["cats.new"]?.fullPath).toBe("/cats/new");
    expect(byKey["cats.$id"]?.fullPath).toBe("/cats/:id");
    expect(byKey["$"]?.fullPath).toBe("/*");
    expect(byKey["cats.$"]?.fullPath).toBe("/cats/*");
  });

  it("wires parent relationships from dotted-prefix matching", () => {
    const routes = discoverFileRoutes([
      "__root.route.ts",
      "cats.route.ts",
      "cats.$id.route.ts",
      "dogs.route.ts",
    ]);
    const byKey = Object.fromEntries(routes.map((r) => [r.key, r]));
    expect(byKey["cats"]?.parentKey).toBe("__root");
    expect(byKey["cats.$id"]?.parentKey).toBe("cats");
    expect(byKey["dogs"]?.parentKey).toBe("__root");
  });

  it("falls back to __root parent when no dotted-prefix file exists", () => {
    const routes = discoverFileRoutes([
      "__root.route.ts",
      "cats.$id.route.ts", // note: no `cats.route.ts`
    ]);
    const byKey = Object.fromEntries(routes.map((r) => [r.key, r]));
    expect(byKey["cats.$id"]?.parentKey).toBe("__root");
  });

  it("computes ownPath relative to parent: bare segment for nested routes", () => {
    const routes = discoverFileRoutes([
      "__root.route.ts",
      "cats.route.ts",
      "cats.$id.route.ts",
      "cats.new.route.ts",
      "cats.index.route.ts",
      "cats.$.route.ts",
    ]);
    const byKey = Object.fromEntries(routes.map((r) => [r.key, r]));
    expect(byKey["cats"]?.ownPath).toBe("cats");
    expect(byKey["cats.$id"]?.ownPath).toBe(":id");
    expect(byKey["cats.new"]?.ownPath).toBe("new");
    expect(byKey["cats.index"]?.ownPath).toBe("");
    expect(byKey["cats.$"]?.ownPath).toBe("*");
  });

  it("generates stable PascalCase export names", () => {
    const routes = discoverFileRoutes([
      "__root.route.ts",
      "index.route.ts",
      "cats.$id.route.ts",
      "cats.$.route.ts",
      "$.route.ts",
    ]);
    const byKey = Object.fromEntries(routes.map((r) => [r.key, r]));
    expect(byKey["__root"]?.exportName).toBe("RootRoute");
    expect(byKey["index"]?.exportName).toBe("IndexRoute");
    expect(byKey["cats.$id"]?.exportName).toBe("CatsIdRoute");
    expect(byKey["cats.$"]?.exportName).toBe("CatsSplatRoute");
    expect(byKey["$"]?.exportName).toBe("SplatRoute");
  });

  it("flags isIndex / isCatchAll / isRoot correctly", () => {
    const routes = discoverFileRoutes([
      "__root.route.ts",
      "index.route.ts",
      "cats.index.route.ts",
      "$.route.ts",
      "about.route.ts",
    ]);
    const byKey = Object.fromEntries(routes.map((r) => [r.key, r]));
    expect(byKey["__root"]?.isRoot).toBe(true);
    expect(byKey["index"]?.isIndex).toBe(true);
    expect(byKey["cats.index"]?.isIndex).toBe(true);
    expect(byKey["$"]?.isCatchAll).toBe(true);
    expect(byKey["about"]?.isCatchAll).toBe(false);
    expect(byKey["about"]?.isIndex).toBe(false);
  });

  it("allows a layout parent and its index child to share a path", () => {
    // `foo.route.ts` and `foo.index.route.ts` both resolve to `/foo`, but
    // the index is intentional: it renders inside the parent's outlet.
    expect(() => discoverFileRoutes(["foo.route.ts", "foo.index.route.ts"])).not.toThrow();
  });

  it("sorts: root first, then by depth, then alphabetically, catch-alls last", () => {
    const routes = discoverFileRoutes([
      "cats.$id.route.ts",
      "$.route.ts",
      "about.route.ts",
      "__root.route.ts",
      "cats.route.ts",
    ]);
    const ordered = routes.map((r) => r.key);
    expect(ordered[0]).toBe("__root");
    expect(ordered.indexOf("about")).toBeLessThan(ordered.indexOf("cats.$id"));
    expect(ordered.indexOf("cats")).toBeLessThan(ordered.indexOf("cats.$id"));
    expect(ordered.indexOf("$")).toBeGreaterThan(ordered.indexOf("about"));
  });

  it("groupByParent buckets children under their parent key", () => {
    const routes = discoverFileRoutes([
      "__root.route.ts",
      "cats.route.ts",
      "cats.$id.route.ts",
      "cats.new.route.ts",
      "dogs.route.ts",
    ]);
    const groups = groupByParent(routes);
    expect(groups.get("__root")?.map((r) => r.key)).toEqual(["cats", "dogs"]);
    expect(groups.get("cats")?.map((r) => r.key)).toEqual(["cats.new", "cats.$id"]);
  });
});
