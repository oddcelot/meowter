# Plan 004: Run each route's `render()` in a reactive root that is disposed on route leave

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a1647dc..HEAD -- packages/meowter/src/create-route.ts packages/meowter/src/create-route.test.ts`
> On any change, compare "Current state" against live code; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (touches the mount/unmount path of every code-defined and file-based route)
- **Depends on**: none (independent of 001–003)
- **Category**: bug
- **Planned at**: commit `a1647dc`, 2026-10-10

## Why this matters

A route's `render(ctx)` receives reactive accessors (`ctx.params`,
`ctx.matched`). A route stays mounted when only its params change
(`/cats/a` → `/cats/b`), so the idiomatic way to keep the DOM current is to
create a `createRenderEffect` / `createMemo` (or call `createLink`, which
creates a memo) **inside** `render`. Today `render` is invoked with no
reactive owner, so those computations are never disposed when the route is
left: they keep tracking the router's signals, keep running on every
navigation, and keep mutating detached DOM. Each re-entry to the route adds
another set. This is a memory/CPU leak and a source of "ghost" updates, and it
blocks the pattern users need for param-reactive views.

## Current state

`packages/meowter/src/create-route.ts` — `createRouter()` → `wireRender()`:

```ts
// create-route.ts:385-428 (approx.)
  function wireRender(route: AnyRoute, routeEl: MeowRoute): () => void {
    const render = route.options.render;
    if (!render) return () => {};

    let mountedNode: Node | null = null;

    const ctx: RouteRenderCtx<AnyRoute, string> = { ... };

    const doMount = (): void => {
      if (mountedNode) return;
      const result = render(ctx);              // <-- no owner
      const node = normalizeRenderResult(result);
      if (!node) return;
      const nestedOutlet = routeEl.querySelector(":scope > meow-outlet");
      if (nestedOutlet) routeEl.insertBefore(node, nestedOutlet);
      else routeEl.appendChild(node);
      mountedNode = node;
    };

    const doUnmount = (): void => {
      if (mountedNode && mountedNode.parentNode === routeEl) {
        routeEl.removeChild(mountedNode);
      }
      mountedNode = null;
    };

    routeEl.addEventListener("route-match", doMount);
    routeEl.addEventListener("route-leave", doUnmount);
    queueMicrotask(() => { if (routeEl.matched) doMount(); });
    return () => { ...removeEventListener...; doUnmount(); };
  }
```

File-based routes (`src/file-routes.ts` `bindFileRoute`) pass their
`config.render` into `createRoute`, so they go through the same `wireRender`
— no separate change needed.

**Exemplar for owner handling** — `packages/meowter/src/outlet-element.ts:58-100`
already does exactly this pattern with `@solidjs/signals`:

```ts
import { createMemo, createRenderEffect, createRoot, runWithOwner } from "@solidjs/signals";
...
    this.#disposeRoot = runWithOwner(null, () =>
      createRoot((dispose) => {
        ...
        return dispose;
      }),
    );
```

Match it. The library is `@solidjs/signals` 2.0 RC (Solid 2 reactive core);
see `docs/solid-2.0/02-signals-derived-ownership.md` in the repo for owner
semantics. Note Solid 2 effects are split: `createRenderEffect(compute, apply)`.

Test conventions: `create-route.test.ts` (`makeTree()` at line ~16; uses
`setURL`, `tick`, `router.mount(document.body)`).

## Commands you will need

| Purpose   | Command (repo root)                                              | Expected |
| --------- | ---------------------------------------------------------------- | -------- |
| Tests     | `pnpm test`                                                      | all pass |
| One file  | `pnpm --filter meowter exec vitest run src/create-route.test.ts` | all pass |
| Typecheck | `pnpm typecheck`                                                 | exit 0   |
| Format    | `pnpm fmt:check`                                                 | exit 0   |

## Scope

**In scope**: `packages/meowter/src/create-route.ts` (`wireRender` only, plus the import line), `packages/meowter/src/create-route.test.ts`.

**Out of scope**: `<meow-route>` / `<meow-outlet>` element logic; `file-routes.ts`; changing the `render` signature or `RouteRenderCtx` type; the examples.

## Git workflow

- Branch `advisor/004-own-route-render-scope`; commit e.g. `fix: Dispose route render scope on leave`. No push.

## Steps

### Step 1: Failing test that proves the leak

In `create-route.test.ts` add a test that builds its own small tree:
root → `catsRoute` (`/cats`) → `catDetailRoute` (`:id`) with a `render` that
does:

```ts
render: ({ params }) => {
  const span = document.createElement("span");
  createRenderEffect(
    () => params().id,
    (id) => { runs++; span.textContent = id ?? ""; },
  );
  return span;
},
```

plus a sibling `aboutRoute` (`/about`). Flow: `setURL("/cats/a")`, mount,
`await tick()`; navigate `/cats/b` → assert span text is `"b"`; navigate
`/about`, `await tick()`, record `const before = runs`; then navigate
`/about?x=1`, `/about?x=2` (URL changes, cat route stays unmatched) and assert
`runs === before`.

Also assert: navigating back to `/cats/c` produces exactly one live effect
(e.g. record `runs` delta after one more param change is `1`, not `2`).

**Verify**: `pnpm --filter meowter exec vitest run src/create-route.test.ts` → the new test FAILS on the `runs === before` or the delta assertion. If it passes on unmodified code, STOP (see below).

### Step 2: Own the render call

In `wireRender`, add `let disposeScope: (() => void) | null = null;` and change `doMount`:

```ts
const doMount = (): void => {
  if (mountedNode || disposeScope) return;
  let result: RouteRenderResult;
  runWithOwner(null, () =>
    createRoot((dispose) => {
      disposeScope = dispose;
      result = render(ctx);
    }),
  );
  const node = normalizeRenderResult(result!);
  if (!node) return;   // keep scope alive: render may have side-effect-only effects
  ...insert as before...
  mountedNode = node;
};
```

and `doUnmount`:

```ts
const doUnmount = (): void => {
  disposeScope?.();
  disposeScope = null;
  ...existing node removal...
};
```

Import `createRoot` and `runWithOwner` from `@solidjs/signals` (add to the
existing type-only `Accessor` import — convert it to a value import:
`import { createRoot, runWithOwner, type Accessor } from "@solidjs/signals";`).

Check the guard: the previous guard was `if (mountedNode) return;`. With the
new one, a render that returns `null` won't be re-invoked on repeated
`route-match` until `route-leave` — this is intended.

**Verify**: `pnpm --filter meowter exec vitest run src/create-route.test.ts` → all pass including the new test.

### Step 3: Full suite

**Verify**: `pnpm test` → all pass (no regression in `file-routes.test.ts`, `link.test.ts`, `outlet-element.test.ts`). `pnpm typecheck` → exit 0.

## Test plan

Step 1's test covers: effect live while matched, effect disposed after leave,
no duplicate effects after re-entry. Pattern: existing tests in
`create-route.test.ts`.

## Done criteria

- [ ] New leak test exists and passes; it failed before Step 2 (state this in the report)
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm fmt:check` exit 0
- [ ] `grep -n "createRoot" packages/meowter/src/create-route.ts` matches inside `wireRender`
- [ ] Only in-scope files modified
- [ ] `plans/README.md` row updated

## STOP conditions

- The Step 1 test passes on unmodified code (Solid 2 already disposes unowned computations here) — report; the finding is invalid.
- `createRoot`/`runWithOwner` signatures differ from the usage in `outlet-element.ts`.
- Any existing test fails because it relied on render being re-invoked after returning `null`.

## Maintenance notes

- When async loaders/pending states arrive (see plan 005), the loader and render should share this scope so aborting a navigation disposes both.
- `createLink()` called inside `render` is now owned and disposed — document this as the recommended usage in the eventual README.
- Consider passing an `onCleanup`-friendly hint in docs: users can call `onCleanup` inside `render` to tear down third-party widgets.
