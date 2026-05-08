import { describe, expect, it } from "vitest";
import { buildCompletionItems, detectContext } from "./completion.ts";

describe("detectContext (html)", () => {
  it("matches inside an unclosed href attribute", () => {
    expect(detectContext("html", '<a href="')).toBe(true);
    expect(detectContext("html", '<a href="/ca')).toBe(true);
    expect(detectContext("html", "  <a href='")).toBe(true);
  });

  it("matches data-href and src similarly", () => {
    expect(detectContext("html", '<button data-href="/')).toBe(true);
    expect(detectContext("html", '<script src="/')).toBe(true);
  });

  it("does not match unrelated attributes", () => {
    expect(detectContext("html", '<h1 title="')).toBe(false);
    expect(detectContext("html", '<a class="')).toBe(false);
  });

  it("does not match a closed string", () => {
    expect(detectContext("html", '<a href="/cats">')).toBe(false);
  });
});

describe("detectContext (ts)", () => {
  it("matches navigate / replace calls with quoted strings", () => {
    expect(detectContext("ts", "router.navigate(\"")).toBe(true);
    expect(detectContext("ts", "router.navigate('")).toBe(true);
    expect(detectContext("ts", "router.navigate(`")).toBe(true);
    expect(detectContext("ts", "router.replace(\"/cats")).toBe(true);
  });

  it("does not match unrelated method calls", () => {
    expect(detectContext("ts", 'fetch("/api/cats")')).toBe(false);
    expect(detectContext("ts", "console.log(\"")).toBe(false);
  });

  it("requires the call to be open (no closing quote yet)", () => {
    expect(detectContext("ts", 'router.navigate("/cats")')).toBe(false);
  });
});

describe("buildCompletionItems", () => {
  it("emits one literal item per path", () => {
    const items = buildCompletionItems(["/", "/cats", "/dogs"]);
    expect(items.map((i) => i.label)).toEqual(["/", "/cats", "/dogs"]);
  });

  it("emits a snippet variant for paths with :params", () => {
    const items = buildCompletionItems(["/cats/:id"]);
    expect(items).toHaveLength(2);
    const literal = items[0]!;
    const snippet = items[1]!;
    expect(literal.label).toBe("/cats/:id");
    expect(literal.insertText).toBe("/cats/:id");
    expect(snippet.label).toContain("/cats/:id");
    expect(snippet.insertText).toBe("/cats/${1:id}");
  });

  it("numbers multiple :params in a single path", () => {
    const items = buildCompletionItems(["/users/:userId/posts/:postId"]);
    const snippet = items.find((i) => i.insertText !== i.label) as
      | { insertText: string }
      | undefined;
    expect(snippet?.insertText).toBe(
      "/users/${1:userId}/posts/${2:postId}",
    );
  });

  it("sorts catch-all (`*`) last via sortText", () => {
    const items = buildCompletionItems(["/cats", "*", "/dogs"]);
    const sorted = [...items].sort((a, b) =>
      (a.sortText ?? a.label).localeCompare(b.sortText ?? b.label),
    );
    expect(sorted[sorted.length - 1]?.label).toBe("*");
  });
});
