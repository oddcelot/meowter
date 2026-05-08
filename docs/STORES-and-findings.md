# Stores design + findings (for later)

Two-part doc:

1. **When and how to bring `createStore` into meowter** — concrete sketches for the features that fit, starting with search params.
2. **Findings worth retaining** — sharp edges and decisions from the Solid-2.0 migration that don't have an obvious home in code comments.

Reference RFC: [`./solid-2.0/04-stores.md`](./solid-2.0/04-stores.md).

---

## Part 1 — Stores

### When stores beat signals (the heuristic)

Use **signals** for shallow, replace-style state:

- One value, replaced wholesale on change (our `currentURL`, `currentState`, `route.matched`).
- Flat object set as a unit each time (our current `route.params`).

Use **stores** when at least one of these is true:

1. **Nested state with per-leaf observability.** A consumer of `state.user.name` shouldn't re-run when `state.user.email` changes.
2. **Collections.** Push/pop/swap shouldn't invalidate every subscriber of the whole array.
3. **Derived async data.** `createStore(fn, seed)` is the function-form derived store — natural fit for "list of things loaded asynchronously, want fine-grained reconcile."
4. **Draft-style mutation.** `setStore(s => { s.user.name = "x" })` is more ergonomic than copying objects, and the runtime tracks the targeted writes.

If the answer is "I just want a single value that updates", a signal is correct and a store is overkill.

### Where stores actually fit in this codebase

A and B below are **implemented** (see "Status" notes). C and D remain future.

#### A. Search params — the most interesting fit

> **Status:** ✅ Implemented in `src/router-element.ts` (`searchParams` getter, `setSearchParam` method, `replace` sibling to `navigate`). Tests in `src/stores.test.ts`. The design below is preserved as the *intent*; the **shipped shape diverges in two places**:
>
> 1. **Multi-value keys** — `searchParams: Record<string, string[]>` (always arrays), not `Record<string, string>`. Honest about `URLSearchParams.getAll()` semantics; consumers do `params.foo?.[0]` for single-value access.
> 2. **`setSearchParam` accepts `string | string[] | null`** — `null` removes the key, `string[]` writes multi-value, `string` writes single. `options.history` defaults to `"replace"` (per design); pass `"push"` for explicit history entries.

**Problem:** the URL signal already carries `?foo=bar&baz=qux`, but selection only inspects `pathname`. If a route's content depends on the query (e.g. a list filtered by `?filter=...`), the consumer has two bad options today:

1. Subscribe to the whole URL signal and re-derive on every change (correct but coarse).
2. Use `route-match` events and DOM-mutate from a listener (imperative, doesn't compose with reactive consumers).

**Design:** expose a derived store on the router whose keys are individual query params. Per-key reactivity falls out for free.

```ts
// router-element.ts — sketch
import { createStore, reconcile } from "@solidjs/signals";

export class MeowRouter extends HTMLElement {
  // ... existing #url, #state signals
  #searchParams = createStore<Record<string, string>>(() => {
    const url = this.currentURL();
    const next: Record<string, string> = {};
    for (const [k, v] of url.searchParams) next[k] = v;
    return next;
  }, {});

  get searchParams(): Record<string, string> {
    return this.#searchParams[0];
  }

  setSearchParam(key: string, value: string | null): void {
    const url = new URL(window.location.href);
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    this.navigate(url.href);
  }
}
```

**Why this works with stores and not signals:**

- `router.searchParams.filter` reads only the `filter` key. A consumer doing `createMemo(() => router.searchParams.filter)` is invalidated only when `filter` changes.
- Setting `?filter=cats` (via `setSearchParam` → `navigate`) updates the URL signal; the derived store's compute re-runs and produces a new flat dict; the runtime reconciles per-key, so consumers of `?sort` don't re-run.
- Crucially, the store form `createStore(fn, seed)` (RFC 04) is the **derived/projection** form — its compute is reactive and the seed is the backing object, not a memo-style initial value.

**Consumer usage (illustrative):**

```ts
const router = document.querySelector("meow-router")!;
createRenderEffect(
  () => router.searchParams.filter,
  (f) => {
    listView.applyFilter(f ?? "");
  },
);
```

**Open questions / decisions:**

- **Coercion?** Today every value is a string. Do we want `searchParams.page` to be a number with a per-key schema? Probably no — keep it strings, let consumers parse. If we want types later: `router.searchParam("page", { as: "number" })` or a separate `createTypedSearchParams(schema)` helper.
- **Multi-value keys?** `?tag=a&tag=b` — `URLSearchParams.getAll("tag")` returns `["a","b"]`. The flat-dict shape above only keeps the first. To preserve all, change the value type to `string | string[]` and do `searchParams.getAll(k)` per key. Probably defer until needed.
- **History strategy** for `setSearchParam` — push or replace? For filters, `replaceState` (no new history entry per keystroke) is usually right. Add an option: `setSearchParam(key, val, { history: "replace" })`.

**Non-goals:** the store should be **read-only** in the public API. Mutation flows through `setSearchParam` so URL stays the source of truth and back/forward keep working.

**Migration shape if we add this:**

| Step                                                              | File                            |
| ----------------------------------------------------------------- | ------------------------------- |
| Add `#searchParams` derived store + `searchParams` getter         | `src/router-element.ts`         |
| Add `setSearchParam(key, value, options?)` method                 | `src/router-element.ts`         |
| Update `RouteChangeDetail` to optionally surface a snapshot       | `src/events.ts` (optional)      |
| New tests: per-key memo only re-runs when its key changes         | `src/signals.test.ts` or new   |
| Demo: `index.html` adds a filter input wired to `setSearchParam`  | `index.html`, `src/main.ts`     |

#### B. Route history — implemented

> **Status:** ✅ Implemented in `src/router-element.ts` (`history` getter exposing `{ entries, index }`). Tests in `src/stores.test.ts`. The shipped shape diverges from the design sketch in one significant way: **`HistoryEntry.url: URL` became `HistoryEntry.href: string`** because URL instances cannot live inside a Solid store proxy (see finding F9 below).
>
> Implementation notes worth remembering:
>
> - **State wrapping.** Each entry gets a synthetic `id: number`. On `navigate`/`replace` we wrap user state in `{ __meowterHistoryId: id, user: <yours> }` and pass the wrapper to `history.pushState`/`replaceState`. On `popstate` we read the id back and find the matching entry — that's how index updates correctly even after multiple back/forwards.
> - **`currentState()` always returns user state.** The wrapper is unwrapped before exposure. Tests assert this (`router.currentState()` returns `{ from: "test" }`, not `{ __meowterHistoryId: ..., user: ... }`).
> - **External popstate** (state shape ≠ ours, e.g. landing on a page someone else pushed) is handled by synthesizing a one-entry stack from the current URL. No throw, no contamination.
> - **`replace()` was added as a sibling to `navigate()`.** Necessary for `setSearchParam` to default to non-history-polluting writes. The shape mirrors `navigate` exactly.
>
> Original design follows for context.

If we ever build "back to last cat detail" UI, we'd want a stack-of-URLs that's both reactive and per-entry observable.

```ts
// router-element.ts — sketch
const [history, setHistory] = createStore<{ entries: URL[]; index: number }>({
  entries: [],
  index: -1,
});

// inside navigate(): setHistory(s => { s.entries.push(url); s.index = s.entries.length - 1 });
// inside popstate handler: setHistory(s => { s.index = ... });
```

Stores fit here because pushing onto `entries` shouldn't invalidate consumers of `index`, and reading `history.entries[history.index]` should track only the active slice. Signals would fire every consumer on every push.

**Pre-req before building this:** decide whether router history mirrors `window.history` (which is what we'd want anyway — no separate stack to keep in sync with reality).

#### C. Lazy / async route data

If `<meow-route>` ever grows a `loader` attribute that fetches data on activation, the loaded data is a natural derived store:

```ts
const [data] = createStore(async () => {
  const id = route.params?.id;
  if (id == null) return null;
  return await fetch(`/api/cats/${id}`).then(r => r.json());
}, null);
```

Async function-form `createStore` produces a store whose compute is recomputed when its deps change, and whose intermediate states integrate with `Loading`/`Errored` boundaries (RFC 05).

**Pre-req:** decide on the loader API shape (`<meow-route loader={fn}>`? property? attribute pointing to a registered loader name?). Whichever way, the data plumbing is a derived store.

#### D. `createProjection` — a niche win

`createProjection(fn, seed)` (RFC 04) creates a derived store with **reactive reconciliation**: it diffs new values against the existing store and only invalidates the keys that actually changed. The 1.x equivalent was `createSelector`, which only worked for "is this key the active one."

We'd want this if we built **active-link styling** as a store rather than per-anchor:

```ts
const [active] = createProjection<Record<string, boolean>>(() => {
  const path = router.currentURL().pathname;
  return Object.fromEntries(allLinks.map(href => [href, isActiveFor(path, href)]));
}, {});
```

Then each `<a>` reads `active[this.href]` and only flips when its own state actually changes. Probably overkill for a small page; sensible if we end up with hundreds of links.

#### E. What does NOT need a store

For honesty: a few things looked store-shaped but aren't.

- **`route.params`** — set wholesale on activate, never partially. Plain signal is right.
- **`outlet.selectedRoute`** — a single ref. Memo is right.
- **`outlet.remainder`** — a single string. Memo is right.

---

## Part 2 — Findings worth keeping

Sharp edges and decisions from the migration that don't fit in code comments.

### F1. `@solidjs/signals` vs `solid-js` umbrella

We picked `@solidjs/signals@2.0.0-beta.10` (zero deps, 357kB unpacked) over `solid-js@2.0.0-beta.10` (the umbrella, 4 transitive deps). Signals-only is the entire reactive surface we use. If we ever need the renderer (`@solidjs/web`), control flow primitives, or async helpers like `Loading`/`Errored`, switch to `solid-js` — they all live there and re-export the same signal primitives.

### F2. Dev-mode `STRICT_READ_UNTRACKED` is a real warning, not noise

When `route.activate()` does `const wasMatched = this.#matched[0]()` from inside the outlet's `createRenderEffect` apply phase, dev mode warns: *"Reactive value read directly in an effect callback will not update."* The warning is correct — the apply phase is **untracked** (RFC 01), so the read doesn't subscribe.

**Fix:** wrap intentional non-tracking reads in `untrack()` to silence the warning and document the intent. Status quo in `route-element.ts`:

```ts
const wasMatched = untrack(this.#matched[0]);
```

If you see this warning anywhere else, the answer is almost always one of:

1. Move the read into the **compute phase** of the effect (where tracking is expected).
2. Wrap in `untrack(...)` if the read is genuinely a snapshot.

### F3. `runWithOwner(null, ...)` for outlet's `createRoot`

In Solid 2.0, `createRoot()` is **owned by the parent reactive scope** by default (RFC 02). For a custom element living in static HTML there's no parent scope today — but the moment a consumer mounts our element inside a Solid 2.0 component, our reactive root becomes a child of theirs. When they unmount, our root tears down while the DOM element may still be alive.

`runWithOwner(null, () => createRoot(...))` explicitly detaches. Cost: one extra wrap. Status quo in `outlet-element.ts`. Apply the same pattern to any future `createRoot` we add inside an element method.

### F4. `flush()` inside an active flush is a no-op

We call `flush()` inside `MeowRoute.activate`/`deactivate` so that direct callers (tests, programmatic use) get sync read-after-write. When `route.activate` is called from inside the outlet's `createRenderEffect` (which runs during a flush triggered by `router.navigate`), the inner `flush()` no-ops. The pending writes commit when the surrounding flush continues.

Side effect: an event listener that fires *during* the surrounding flush and reads `route.matched` will see the **previous** value. If a consumer needs the new state inside their `route-match` listener, they should use `event.detail.params` (which carries the new params) rather than reading `route.params` off the element. Document this in the README when we write one.

### F5. `ownedWrite: true` is the explicit "I'm writing from imperative code" flag

We use `ownedWrite: true` on:

- `MeowRouter.#url` (set from `connectedCallback` / `navigate` / `onPopState`)
- `MeowRouter.#state` (same)
- `MeowRoute.#matched` (set from `activate` / `deactivate`)
- `MeowRoute.#params` (same)

Without it, dev mode throws `SIGNAL_WRITE_IN_OWNED_SCOPE` because these methods are technically called from within owned scopes (the outlet's effect, in particular). The flag tells the runtime "yes, this is intentional imperative bookkeeping." It's not an escape hatch for app state.

### F6. `equals: (a, b) => a.href === b.href` on the URL signal

URL objects compared with `Object.is` (the default) are different instances for the same href, so `router.navigate("/dogs")` twice would notify subscribers twice. Custom `equals` dedups properly. If we add `currentState` deduping, decide what equality means for arbitrary state — probably `Object.is` (default), with consumers using `replaceState` semantics for true no-ops.

### F7. `queueMicrotask` in outlet's `connectedCallback` is about happy-dom, not Solid

happy-dom's `innerHTML` parser fires `connectedCallback` on the parent before children have been added. Reading `this.children` at connect time gets `[]`. We defer outlet setup with `queueMicrotask(() => this.#setup())` so children are present.

This isn't a Solid 2.0 concern — it would happen with any reactivity library or no library at all. Real browsers don't do this. If we ever drop happy-dom in tests for a real browser harness, the microtask defer can go too.

### F8. Define order matters: route before outlet

`outlet-element.ts:84-90` — outlet's setup uses `instanceof MeowRoute` on its children. If `meow-outlet` were defined before `meow-route`, those children would still be `HTMLUnknownElement`-ish at connect time and fail the check. `index.ts` enforces the order via import sequence:

```ts
import "./router-element.ts";
import "./route-element.ts";
import "./outlet-element.ts";
```

Don't reorder casually.

### F9. Built-in classes with private slots break Solid stores

`URL`, `URLSearchParams`, `Map`, `Set`, `Date`, and any other built-in (or user) class that uses private fields (`#foo`) or internal slots (`Reflect.get`-incompatible) **cannot be stored as values inside a Solid store**. The store wraps every value in a tracking proxy. When the proxy traps `get` and forwards to the underlying object, methods like `URL.prototype.pathname`'s getter try to access `this.#context` (or equivalent) — and `this` is the proxy, not the original instance. Result:

```
TypeError: Cannot read private member #context from an object whose class did not declare it
```

We hit this when `HistoryEntry.url: URL` was first stored. Fix: store `href: string` and let consumers `new URL(entry.href, base)` if they need parsing.

**Rule of thumb:** store values inside a Solid store should be plain JSON-shaped (objects, arrays, primitives). For anything class-instance-y, store an "address" (id, href, key) and look the real instance up outside the store.

This isn't a Solid bug — it's how JS private fields work with proxies. Same gotcha exists in MobX, Vue's `reactive()`, etc.

### F10. `vi.spyOn` doesn't auto-restore between tests

When tests in `src/stores.test.ts` first ran, the `replace()` test failed because a `pushState` call from a *previous* test was attributed to the spy in the current test. Vitest's default config doesn't restore spies automatically. Fix: explicit `vi.restoreAllMocks()` in `afterEach`. Already done in `router-element.test.ts`; replicate in any test file using `vi.spyOn` on shared globals like `window.history`.

Alternatively, set `restoreMocks: true` in `vite.config.ts`'s `test` block to make this the default — worth doing if we add more spy-using tests. Not done yet because explicit `restoreAllMocks` is more grep-able.

### F11. What we explicitly didn't do, and why

- **Module-scope signals.** Could silence `ownedWrite` requirement. Trade-off: makes the URL global across all `<meow-router>` instances. Today nobody mounts two; if they did, surprising. Keep the flag.
- **`createEffect` instead of `createRenderEffect`.** `createEffect` batches into a microtask. We need synchronous DOM updates so `flush()` callers see the latest paint state. `createRenderEffect` is correct.
- **`lazy: true` on memos.** `selection`/`remainder`/`selectedRoute` are always observed by our render effect. Lazy buys nothing.
- **Active-link styling.** Not in scope yet. When it is, see Part 1.D's projection idea above.

---

## Pointers

- Solid 2.0 RFC index: [`./solid-2.0/README.md`](./solid-2.0/README.md)
- Stores RFC: [`./solid-2.0/04-stores.md`](./solid-2.0/04-stores.md)
- Async data RFC: [`./solid-2.0/05-async-data.md`](./solid-2.0/05-async-data.md) (relevant for Section 1.C)
- Reactivity RFC: [`./solid-2.0/01-reactivity-batching-effects.md`](./solid-2.0/01-reactivity-batching-effects.md) (relevant for F2/F4/F5)
- Per-codebase migration history: [`./MIGRATION-meowter-to-solid-2.0.md`](./MIGRATION-meowter-to-solid-2.0.md)
