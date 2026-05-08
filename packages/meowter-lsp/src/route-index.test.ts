import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRouteIndex, type RouteIndex } from "./route-index.ts";

let workdir = "";
let index: RouteIndex | null = null;

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe("createRouteIndex", () => {
  beforeEach(async () => {
    workdir = await mkdtemp(resolve(tmpdir(), "meowter-lsp-"));
  });

  afterEach(async () => {
    await index?.dispose();
    index = null;
    await rm(workdir, { recursive: true, force: true });
  });

  it("populates paths from existing HTML before resolving", async () => {
    await writeFile(
      resolve(workdir, "index.html"),
      `<meow-outlet>
        <meow-route path="/">home</meow-route>
        <meow-route path="/cats">
          <meow-outlet><meow-route path=":id">d</meow-route></meow-outlet>
        </meow-route>
      </meow-outlet>`,
      "utf8",
    );

    index = await createRouteIndex({
      workspaceFolders: [workdir],
    });
    expect(index.paths()).toEqual(["/", "/cats", "/cats/:id"]);
  });

  it("updates when an HTML file changes", async () => {
    const file = resolve(workdir, "index.html");
    await writeFile(file, '<meow-route path="/cats">x</meow-route>', "utf8");

    index = await createRouteIndex({
      workspaceFolders: [workdir],
    });
    expect(index.paths()).toEqual(["/cats"]);

    let notified = 0;
    index.onChange(() => notified++);

    await writeFile(
      file,
      '<meow-route path="/dogs">x</meow-route>',
      "utf8",
    );

    // chokidar polling settles within awaitWriteFinish window
    for (let i = 0; i < 40; i++) {
      if (index.paths().includes("/dogs")) break;
      await wait(50);
    }
    expect(index.paths()).toEqual(["/dogs"]);
    expect(notified).toBeGreaterThan(0);
  });

  it("recursively picks up files in nested directories", async () => {
    const sub = resolve(workdir, "examples", "demo");
    await mkdir(sub, { recursive: true });
    await writeFile(
      resolve(sub, "index.html"),
      '<meow-route path="/nested">x</meow-route>',
      "utf8",
    );

    index = await createRouteIndex({
      workspaceFolders: [workdir],
    });
    expect(index.paths()).toEqual(["/nested"]);
  });
});
