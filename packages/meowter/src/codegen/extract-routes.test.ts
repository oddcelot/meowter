import { describe, expect, it } from "vitest";
import { extractRoutesFromHtml } from "./extract-routes.ts";

describe("extractRoutesFromHtml", () => {
  it("extracts top-level static routes", () => {
    const html = `
      <meow-router>
        <meow-outlet>
          <meow-route path="/">home</meow-route>
          <meow-route path="/cats">cats</meow-route>
          <meow-route path="/dogs">dogs</meow-route>
        </meow-outlet>
      </meow-router>
    `;
    expect(extractRoutesFromHtml(html)).toEqual(["/", "/cats", "/dogs"]);
  });

  it("composes nested child paths against the parent", () => {
    const html = `
      <meow-route path="/cats">
        <meow-outlet>
          <meow-route path=":id">detail</meow-route>
          <meow-route path="new">new</meow-route>
        </meow-outlet>
      </meow-route>
    `;
    expect(extractRoutesFromHtml(html)).toEqual([
      "/cats",
      "/cats/:id",
      "/cats/new",
    ]);
  });

  it("treats an index route ('') as the parent's path", () => {
    const html = `
      <meow-route path="/cats">
        <meow-outlet>
          <meow-route path="">all</meow-route>
          <meow-route path=":id">detail</meow-route>
        </meow-outlet>
      </meow-route>
    `;
    const paths = extractRoutesFromHtml(html);
    expect(paths).toContain("/cats");
    expect(paths).toContain("/cats/:id");
    // index for /cats dedupes against the parent
    expect(paths.filter((p) => p === "/cats")).toHaveLength(1);
  });

  it("emits the catch-all verbatim and sorts it last", () => {
    const html = `
      <meow-outlet>
        <meow-route path="/cats">cats</meow-route>
        <meow-route path="*">404</meow-route>
        <meow-route path="/dogs">dogs</meow-route>
      </meow-outlet>
    `;
    expect(extractRoutesFromHtml(html)).toEqual(["/cats", "/dogs", "*"]);
  });

  it("strips the {{BASE}} placeholder by default", () => {
    const html = `
      <meow-outlet>
        <meow-route path="{{BASE}}">home</meow-route>
        <meow-route path="{{BASE}}cats">cats</meow-route>
      </meow-outlet>
    `;
    expect(extractRoutesFromHtml(html)).toEqual(["/", "/cats"]);
  });

  it("respects a custom basePlaceholder", () => {
    const html = `
      <meow-route path="<%base%>cats">cats</meow-route>
    `;
    expect(
      extractRoutesFromHtml(html, { basePlaceholder: "<%base%>" }),
    ).toEqual(["/cats"]);
  });

  it("skips routes with no path attribute", () => {
    const html = `
      <meow-outlet>
        <meow-route>broken</meow-route>
        <meow-route path="/cats">cats</meow-route>
      </meow-outlet>
    `;
    expect(extractRoutesFromHtml(html)).toEqual(["/cats"]);
  });

  it("dedupes paths declared in multiple places", () => {
    const html = `
      <meow-outlet>
        <meow-route path="/cats">cats a</meow-route>
        <meow-route path="/cats">cats b</meow-route>
      </meow-outlet>
    `;
    expect(extractRoutesFromHtml(html)).toEqual(["/cats"]);
  });

  it("matches the kitchen sink shape after BASE stripping", () => {
    const html = `
      <meow-outlet>
        <meow-route path="{{BASE}}">home</meow-route>
        <meow-route path="{{BASE}}cats">
          <meow-outlet>
            <meow-route path="">all</meow-route>
            <meow-route path="new">new</meow-route>
            <meow-route path=":id">detail</meow-route>
          </meow-outlet>
        </meow-route>
        <meow-route path="{{BASE}}dogs">dogs</meow-route>
        <meow-route path="*">404</meow-route>
      </meow-outlet>
    `;
    expect(extractRoutesFromHtml(html)).toEqual([
      "/",
      "/cats",
      "/cats/:id",
      "/cats/new",
      "/dogs",
      "*",
    ]);
  });
});
