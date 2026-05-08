import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "./index.ts";
import type { MeowRouter } from "./router-element.ts";
import type { MeowRoute } from "./route-element.ts";

function setURL(path: string): void {
  window.history.replaceState(null, "", path);
}

function mount(html: string, base?: string): MeowRouter {
  const baseAttr = base !== undefined ? ` base="${base}"` : "";
  document.body.innerHTML = `<meow-router${baseAttr}>${html}</meow-router>`;
  return document.body.firstElementChild as MeowRouter;
}

async function tick(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("base awareness", () => {
  beforeEach(() => {
    setURL("/");
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("strips base from currentURL.pathname for outlet matching", async () => {
    setURL("/meowter/cats");
    const router = mount(
      `
      <meow-outlet>
        <meow-route path="/cats">cats</meow-route>
        <meow-route path="/dogs">dogs</meow-route>
      </meow-outlet>
    `,
      "/meowter/",
    );
    await tick();
    const cats = router.querySelector<MeowRoute>('meow-route[path="/cats"]')!;
    const dogs = router.querySelector<MeowRoute>('meow-route[path="/dogs"]')!;
    expect(cats.matched).toBe(true);
    expect(dogs.matched).toBe(false);
  });

  it("routablePathname returns base-stripped pathname", async () => {
    setURL("/meowter/cats/whiskers");
    const router = mount("", "/meowter/");
    await tick();
    expect(router.routablePathname()).toBe("/cats/whiskers");
  });

  it("routablePathname returns '/' when at the base root", async () => {
    setURL("/meowter/");
    const router = mount("", "/meowter/");
    await tick();
    expect(router.routablePathname()).toBe("/");
  });

  it("navigate('/cats') prepends base under sub-path deploys", async () => {
    setURL("/meowter/");
    const router = mount("", "/meowter/");
    await tick();
    router.navigate("/cats");
    expect(window.location.pathname).toBe("/meowter/cats");
  });

  it("navigate is idempotent on already-prefixed paths", async () => {
    setURL("/meowter/");
    const router = mount("", "/meowter/");
    await tick();
    router.navigate("/meowter/cats");
    expect(window.location.pathname).toBe("/meowter/cats");
  });

  it("base defaults to '/' (no transformation)", async () => {
    setURL("/");
    const router = mount("");
    await tick();
    expect(router.base).toBe("/");
    router.navigate("/cats");
    expect(window.location.pathname).toBe("/cats");
  });

  it("normalizes a base attribute without trailing slash", async () => {
    const router = mount("", "/meowter");
    await tick();
    expect(router.base).toBe("/meowter/");
  });

  it("nested outlet under sub-path receives base-stripped remainder", async () => {
    setURL("/meowter/cats/whiskers");
    const router = mount(
      `
      <meow-outlet>
        <meow-route path="/cats">
          <meow-outlet>
            <meow-route path="">all</meow-route>
            <meow-route path=":id">detail</meow-route>
          </meow-outlet>
        </meow-route>
      </meow-outlet>
    `,
      "/meowter/",
    );
    await tick();
    const detail = router.querySelector<MeowRoute>('meow-route[path=":id"]')!;
    expect(detail.matched).toBe(true);
    expect(detail.params).toEqual({ id: "whiskers" });
  });

  it("click intercept on a base-less <a href> still hits the right route under base", async () => {
    setURL("/meowter/");
    const router = mount(
      `
      <meow-outlet>
        <meow-route path="/cats">cats</meow-route>
      </meow-outlet>
      <a id="lnk" href="/cats">cats</a>
    `,
      "/meowter/",
    );
    await tick();
    const anchor = router.querySelector<HTMLAnchorElement>("#lnk")!;
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 0,
    });
    anchor.dispatchEvent(event);
    expect(window.location.pathname).toBe("/meowter/cats");
    const cats = router.querySelector<MeowRoute>('meow-route[path="/cats"]')!;
    expect(cats.matched).toBe(true);
  });
});
