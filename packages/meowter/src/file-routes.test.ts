import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "./index.ts";
import {
  bindFileRootRoute,
  bindFileRoute,
  createFileRootRoute,
  createFileRoute,
} from "./file-routes.ts";
import { createRouter } from "./create-route.ts";
import { setURL, tick } from "./test-helpers.ts";

beforeEach(() => {
  setURL("/");
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createFileRoute / bindFileRoute", () => {
  it("createFileRoute returns a tagged FileRoute holding path + config", () => {
    const fr = createFileRoute("/about")({});
    expect(fr.__brand).toBe("MeowterFileRoute");
    expect(fr.path).toBe("/about");
  });

  it("bindFileRoute wires the parent and produces a real Route", () => {
    const root = bindFileRootRoute(createFileRootRoute());
    const catsFr = createFileRoute("/cats")({});
    const cats = bindFileRoute(catsFr, root, "/cats");

    expect(cats.fullPath).toBe("/cats");
    expect(cats.parent).toBe(root);
    expect(cats.path).toBe("/cats");
  });

  it("composes a tree end-to-end that drives navigation", async () => {
    const rootFr = createFileRootRoute();
    const homeFr = createFileRoute("/")({ render: () => "home" });
    const catsFr = createFileRoute("/cats")({});
    const catDetailFr = createFileRoute("/cats/:id")({
      render: ({ params }) => {
        const span = document.createElement("span");
        span.className = "cat-detail";
        span.textContent = params().id;
        return span;
      },
    });

    const root = bindFileRootRoute(rootFr);
    const home = bindFileRoute(homeFr, root, "");
    const cats = bindFileRoute(catsFr, root, "/cats");
    const catDetail = bindFileRoute(catDetailFr, cats, ":id");

    const routeTree = root.addChildren([home, cats.addChildren([catDetail])]);

    setURL("/cats/whiskers");
    const router = createRouter({ routeTree, basepath: "/" });
    router.mount(document.body);
    await tick();
    await tick();

    expect(catDetail.useMatched()()).toBe(true);
    expect(catDetail.useParams()()).toEqual({ id: "whiskers" });
    expect(document.body.querySelector(".cat-detail")?.textContent).toBe("whiskers");
  });

  it("createFileRootRoute supports an optional render config", () => {
    const root = createFileRootRoute({
      render: () => "root-rendered",
    });
    expect(root.path).toBe("/");
    expect(root.config.render).toBeDefined();
  });
});
