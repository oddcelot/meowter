# Migrating meowter to Solid 2.0 (beta)

A focused migration plan for **this** codebase. Upstream RFCs live in [`./solid-2.0/`](./solid-2.0/); start with [`./solid-2.0/MIGRATION.md`](./solid-2.0/MIGRATION.md) for the full picture.

## What we use today

We're on **`@solidjs/signals@0.13.13`** (the standalone reactivity package that predated `solid-js@next`). Surface area in the codebase is tiny — grep for `@solidjs/signals` across `src/` returns:

| File                   | Imports                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `src/router-element.ts`| `createSignal`, `flush`, `Accessor` (type)                    |
| `src/outlet-element.ts`| `createMemo`, `createRenderEffect`, `createRoot`, `Accessor`  |
| `src/signals.test.ts`  | `createMemo`, `createRenderEffect`, `createRoot`              |

We don't touch JSX, stores, async data, control flow, contexts, `createEffect`, `onMount`, `onCleanup`, `untrack`, `batch`, or any of the renderer packages. That makes our migration a near-trivial subset of what the upstream guide covers.

## Required changes (the whole list)

### 1. Bump the dep

```jsonc
// package.json
"dependencies": {
-  "@solidjs/signals": "^0.13.13"
+  "@solidjs/signals": "^2.0.0-beta.10"
}
```

`pnpm install` and that's it for tooling. Optionally jump to the full **`solid-js@2.0.0-beta.10`** umbrella package — it re-exports everything we use from `@solidjs/signals@2.0.0-beta.x` and adds renderer/control-flow APIs we don't need. Sticking with `@solidjs/signals` keeps the dep slimmer (zero transitive deps vs. four for `solid-js`).

### 2. `pureWrite` → `ownedWrite`

The only API rename that hits us. Diagnostic code is the same (`SIGNAL_WRITE_IN_OWNED_SCOPE`); the option got renamed to match.

```diff
// src/router-element.ts
   #url = createSignal<URL>(INITIAL_URL, {
-    pureWrite: true,
+    ownedWrite: true,
     equals: (a, b) => a.href === b.href,
   });
-  #state = createSignal<unknown>(null, { pureWrite: true });
+  #state = createSignal<unknown>(null, { ownedWrite: true });
```

That's the entire required diff.

## Behavioral checks (nothing should change but verify)

Our existing semantics already match Solid 2.0's:

- **Microtask batching is the model** — we already call `flush()` after writes in `router.navigate`, `popstate`, and `connectedCallback` to make consumers see writes synchronously. 2.0 keeps `flush()` exactly as it is.
- **Split effects** — we already use `createRenderEffect(compute, apply)` in `outlet-element.ts:67-74`. 2.0 confirms this as the canonical shape; the alternative single-callback `createTrackedEffect` is documented as "not the default."
- **`equals` on the URL signal** — same option, same semantics. Custom `(a, b) => a.href === b.href` continues to work.
- **`createMemo`** — second arg is `options` in both versions; we never passed an `initialValue`, so nothing to fix.
- **`createRoot` in `outlet-element.ts:38`** — see [improvement #1 below](#improvements-worth-applying-after-the-bump) for an actual semantic change in 2.0 worth opting around.

After bumping + the rename: `pnpm typecheck`, `pnpm test` (53 cases), and a `pnpm dev` smoke pass should all be green.

## Improvements worth applying after the bump

These are 2.0-era idioms that we *could* adopt now that we're current. None are required for correctness.

### 1. Explicitly detach the outlet's reactive root

**Why:** In 2.0, `createRoot()` inside an existing owned scope is **owned by that parent** by default (RFC 02 — Ownership). Today our outlets are constructed by the browser parser, so there's no Solid owner above us. But the moment a consumer mounts `<meow-router>` inside a Solid 2.0 component, our outlet's `createRoot` would inherit that component's owner — and when the consumer's component unmounts, our reactive graph would be torn down out from under us while the DOM element is potentially still alive.

**Fix:** wrap the `createRoot` call in `runWithOwner(null, …)` so the lifecycle is bound to our element's `disconnectedCallback` only.

```diff
// src/outlet-element.ts
-import {
-  createMemo,
-  createRenderEffect,
-  createRoot,
-  type Accessor,
-} from "@solidjs/signals";
+import {
+  createMemo,
+  createRenderEffect,
+  createRoot,
+  runWithOwner,
+  type Accessor,
+} from "@solidjs/signals";

   …
-  this.#disposeRoot = createRoot((dispose) => {
+  this.#disposeRoot = runWithOwner(null, () => createRoot((dispose) => {
     // memos + render effect …
     return dispose;
-  });
+  }));
```

(Same applies to the test's `createRoot` calls if we ever embed those in a host owner. For our current tests, no change needed.)

### 2. Drop the `pureWrite` workaround entirely (if we're willing)

The `ownedWrite: true` option exists because we set the URL signal from **inside** `connectedCallback`/`navigate`/`popstate`, and dev mode treats those as "owned scope" in a borderline way. If we instead created the signals **outside** the class constructor (module-scope, then bind to instance) the warning wouldn't fire.

Trade-off: module-scope signals turn the URL into application-global singleton state shared across all `<meow-router>` instances on a page. Today nobody mounts two routers on one page, but the explicit `ownedWrite` flag documents that we *meant* to write from instance code. **Recommendation: keep the flag**, just rename it.

### 3. Optional: `lazy` memos in the outlet

`createMemo(fn, { lazy: true })` defers initial computation until first read and adds autodisposal when subscriber count drops to zero (RFC 01).

Our outlet's `selection`/`remainder`/`selectedRoute` memos are read by:
- Our own `createRenderEffect` (always observed)
- Nested outlets reading parent `remainder()` (when nested outlets exist)
- External code reading `outlet.selectedRoute()` (signals.test.ts uses this)

Since at least the render effect always reads them, they're never unobserved → `lazy: true` saves nothing here. **Skip.**

### 4. Optional: `createEffect` instead of `createRenderEffect` for non-DOM work

`createRenderEffect` runs synchronously during render. `createEffect` batches into a microtask and integrates with `Loading`/`Errored` boundaries (which we don't use, but consumers in a Solid 2.0 app might).

We use `createRenderEffect` to call `route.activate()`/`deactivate()` — those mutate `route.hidden` and dispatch DOM events. Synchronous is the right choice because consumers expect "after `router.navigate(); flush();` the DOM is up to date." **Keep `createRenderEffect`.**

### 5. Optional: expose `route.matched` / `route.params` as signals too

Currently `MeowRoute.matched` / `.params` are plain mutable fields. Reasoning is in the previous migration step: tests do `route.activate(...); expect(route.matched).toBe(true)` and signals defer the write until flush.

Solid 2.0 doesn't change that calculus — but it **does** make `ownedWrite: true` the explicit, sanctioned escape hatch for "I'm writing to a signal from imperative code, on purpose." If we ever want `route.matched` to be a tracking-friendly accessor on the public API, the path is:

1. Convert `matched`/`params` to `createSignal(..., { ownedWrite: true })`.
2. In `activate`/`deactivate`, set the signals AND call `flush()` immediately so read-after-write tests still pass.
3. Expose via getter that calls the accessor (so `route.matched` stays a `boolean` to legacy consumers, but reading it inside a Solid memo tracks).

Not required. Worth filing under "if a consumer asks for it."

### 6. Optional: `unobserved` callbacks for resource cleanup

If we ever add lazy data loading (e.g. async route content), `createSignal(value, { unobserved: () => cleanup() })` fires when the last subscriber goes away — natural fit for closing fetch streams, websockets, etc. Not actionable today but a tool to remember.

## Things 2.0 changes that don't affect us

A subset of the upstream migration matrix that doesn't touch any of our code, listed so a future reader doesn't search:

- `solid-js/store` → `solid-js` — we don't use stores.
- `solid-js/web` → `@solidjs/web` — we don't use the renderer.
- `jsxImportSource` change — no JSX in this repo.
- `Suspense` → `Loading`, `ErrorBoundary` → `Errored` — no boundaries in use.
- `createResource` removal, `action()`, `createOptimistic*` — no async data primitives.
- `Index`/`For` accessor change — no list rendering.
- `mergeProps`/`splitProps` → `merge`/`omit` — not used.
- `Context.Provider` → context-as-provider — no contexts.
- `use:` directives, `attr:`/`bool:` namespaces — DOM authored as plain HTML in `index.html`.
- `produce`, `unwrap`, `createMutable`, `createDeferred`, `from`/`observable`, `onMount`, `onError`/`catchError`, `batch`, `createComputed` — none used.

## Verification plan

After applying the required diff:

1. `pnpm install`
2. `pnpm typecheck` — clean
3. `pnpm test` — all 53 cases pass (router 9, route 4, outlet 10, path-compile 7, path-select 10, link-intercept 9, signals 4)
4. `pnpm dev` — sanity-check `/`, `/cats`, `/cats/whiskers` (param fills), `/cats/new` (literal beats `:id`), `/garbage` (catch-all), browser back, hard refresh on `/cats/whiskers`. Console clean.

If improvement #1 (`runWithOwner(null, …)`) is also applied, no test should change behavior — it's purely defensive against future host-Solid integration.

## TL;DR

```diff
# package.json
-  "@solidjs/signals": "^0.13.13"
+  "@solidjs/signals": "^2.0.0-beta.10"

# src/router-element.ts (two spots)
-  pureWrite: true
+  ownedWrite: true
```

That's the migration. Everything else is preference.
