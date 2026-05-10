import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemo, createRenderEffect, createRoot } from "@solidjs/signals";
import "./index.ts";
import type { MeowRouter } from "./router-element.ts";
import type { MeowOutlet } from "./outlet-element.ts";
import type { MeowRoute } from "./route-element.ts";
import { mountRouter, setURL, tick } from "./test-helpers.ts";

const mount = (html: string): MeowRouter => mountRouter(html);

describe("reactive surface (Solid signals)", () => {
  beforeEach(() => {
    setURL("/");
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("router exposes a tracking-friendly currentURL accessor", async () => {
    setURL("/cats");
    const router = mount("");
    await tick();

    const log: string[] = [];
    const dispose = createRoot((d) => {
      createRenderEffect(
        () => router.currentURL().pathname,
        (p) => {
          log.push(p);
        },
      );
      return d;
    });

    expect(log).toEqual(["/cats"]);

    router.navigate("/dogs");
    expect(log).toEqual(["/cats", "/dogs"]);

    router.navigate("/dogs");
    expect(log).toEqual(["/cats", "/dogs"]);

    router.navigate("/birds");
    expect(log).toEqual(["/cats", "/dogs", "/birds"]);

    dispose();
  });

  it("router exposes a tracking-friendly currentState accessor", async () => {
    const router = mount("");
    await tick();

    const log: unknown[] = [];
    const dispose = createRoot((d) => {
      createRenderEffect(
        () => router.currentState(),
        (s) => {
          log.push(s);
        },
      );
      return d;
    });

    router.navigate("/x", { step: 1 });
    router.navigate("/y", { step: 2 });
    expect(log).toEqual([null, { step: 1 }, { step: 2 }]);

    dispose();
  });

  it("outlet exposes selectedRoute and remainder accessors that update with the URL", async () => {
    setURL("/cats");
    const router = mount(`
      <meow-outlet id="ol">
        <meow-route path="/cats">
          <meow-outlet id="inner">
            <meow-route path="">all</meow-route>
            <meow-route path=":id">detail</meow-route>
          </meow-outlet>
        </meow-route>
        <meow-route path="/dogs">dogs</meow-route>
      </meow-outlet>
    `);
    await tick();

    const outer = router.querySelector<MeowOutlet>("#ol")!;
    const inner = router.querySelector<MeowOutlet>("#inner")!;

    expect(outer.selectedRoute()?.getAttribute("path")).toBe("/cats");
    expect(outer.remainder()).toBe("");
    expect(inner.selectedRoute()?.getAttribute("path")).toBe("");

    router.navigate("/cats/whiskers");
    expect(outer.selectedRoute()?.getAttribute("path")).toBe("/cats");
    expect(outer.remainder()).toBe("/whiskers");
    expect(inner.selectedRoute()?.getAttribute("path")).toBe(":id");

    router.navigate("/dogs");
    expect(outer.selectedRoute()?.getAttribute("path")).toBe("/dogs");
    expect(inner.selectedRoute()).toBeNull();
  });

  it("route exposes tracking-friendly matchedAccessor and paramsAccessor", async () => {
    setURL("/cats");
    const router = mount(`
      <meow-outlet>
        <meow-route path="/cats">cats</meow-route>
        <meow-route path="/cats/:id">detail</meow-route>
        <meow-route path="/dogs">dogs</meow-route>
      </meow-outlet>
    `);
    await tick();
    const cats = router.querySelector<MeowRoute>("meow-route[path='/cats']")!;
    const detail = router.querySelector<MeowRoute>("meow-route[path='/cats/:id']")!;

    const matchedSeq: boolean[] = [];
    const paramsSeq: Array<Record<string, string> | null> = [];
    const dispose = createRoot((d) => {
      createRenderEffect(
        () => cats.matchedAccessor(),
        (v) => {
          matchedSeq.push(v);
        },
      );
      createRenderEffect(
        () => detail.paramsAccessor(),
        (v) => {
          paramsSeq.push(v);
        },
      );
      return d;
    });

    expect(matchedSeq).toEqual([true]);
    expect(paramsSeq).toEqual([null]);

    router.navigate("/cats/whiskers");
    expect(matchedSeq).toEqual([true, false]);
    expect(paramsSeq).toEqual([null, { id: "whiskers" }]);

    router.navigate("/cats/mittens");
    expect(paramsSeq).toEqual([null, { id: "whiskers" }, { id: "mittens" }]);

    router.navigate("/dogs");
    expect(matchedSeq).toEqual([true, false]);
    expect(paramsSeq).toEqual([null, { id: "whiskers" }, { id: "mittens" }, null]);

    dispose();
  });

  it("an external memo over outlet.selectedRoute reacts when navigating", async () => {
    setURL("/");
    const router = mount(`
      <meow-outlet id="ol">
        <meow-route path="/">home</meow-route>
        <meow-route path="/cats">cats</meow-route>
      </meow-outlet>
    `);
    await tick();
    const outer = router.querySelector<MeowOutlet>("#ol")!;

    let runs = 0;
    const dispose = createRoot((d) => {
      const path = createMemo(() => outer.selectedRoute()?.getAttribute("path") ?? null);
      createRenderEffect(
        () => path(),
        () => {
          runs++;
        },
      );
      return d;
    });

    expect(runs).toBe(1);

    router.navigate("/cats");
    expect(runs).toBe(2);

    router.navigate("/cats");
    expect(runs).toBe(2);

    dispose();
  });
});
