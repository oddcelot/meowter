import { describe, expect, it } from "vitest";
import { compilePath, extractParams } from "./path-compile.ts";

describe("compilePath", () => {
  it("compiles a static path with exact + prefix regexes", () => {
    const cp = compilePath("/cats");
    expect(cp.exact.test("/cats")).toBe(true);
    expect(cp.exact.test("/cats/")).toBe(true);
    expect(cp.exact.test("/cats/whiskers")).toBe(false);
    expect(cp.prefix.test("/cats")).toBe(true);
    expect(cp.prefix.test("/cats/whiskers")).toBe(true);
    expect(cp.prefix.test("/cat")).toBe(false);
  });

  it("captures :params and tracks paramNames", () => {
    const cp = compilePath("/cats/:id");
    expect(cp.paramNames).toEqual(["id"]);
    const m = cp.exact.exec("/cats/whiskers");
    expect(m).not.toBeNull();
    expect(m![1]).toBe("whiskers");
  });

  it("supports multiple :params in order", () => {
    const cp = compilePath("/users/:userId/posts/:postId");
    expect(cp.paramNames).toEqual(["userId", "postId"]);
    const m = cp.exact.exec("/users/42/posts/7");
    expect(m).not.toBeNull();
    expect(extractParams(cp, m!)).toEqual({ userId: "42", postId: "7" });
  });

  it("flags index and catch-all", () => {
    expect(compilePath("").isIndex).toBe(true);
    expect(compilePath("*").isCatchAll).toBe(true);
    expect(compilePath("/cats").isIndex).toBe(false);
    expect(compilePath("/cats").isCatchAll).toBe(false);
  });

  it("escapes regex metacharacters in literal segments", () => {
    const cp = compilePath("/foo.bar");
    expect(cp.exact.test("/foo.bar")).toBe(true);
    expect(cp.exact.test("/fooXbar")).toBe(false);
  });

  it("normalizes path without leading slash", () => {
    const cp = compilePath("cats");
    expect(cp.exact.test("/cats")).toBe(true);
  });
});

describe("extractParams", () => {
  it("URI-decodes captured values", () => {
    const cp = compilePath("/q/:term");
    const m = cp.exact.exec("/q/hello%20world")!;
    expect(extractParams(cp, m)).toEqual({ term: "hello world" });
  });
});
