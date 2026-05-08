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

The features below are **future** — we have no consumer asking for them today. This section documents how to plug them in cleanly when the time comes.

#### A. Search params — the most interesting fit

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

#### B. Route history — when we add back/forward UI

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

### F9. What we explicitly didn't do, and why

- **Module-scope signals.** Could silence `ownedWrite` requirement. Trade-off: makes the URL global across all `<meow-router>` instances. Today nobody mounts two; if they did, surprising. Keep the flag.
- **`createEffect` instead of `createRenderEffect`.** `createEffect` batches into a microtask. We need synchronous DOM updates so `flush()` callers see the latest paint state. `createRenderEffect` is correct.
- **`lazy: true` on memos.** `selection`/`remainder`/`selectedRoute` are always observed by our render effect. Lazy buys nothing.
- **Active-link styling.** Not in scope yet. When it is, see F1's projection idea above.
- **Route history exposure.** Handled by `window.history` already. Build a wrapper only when there's a UI need.

---

## Pointers

- Solid 2.0 RFC index: [`./solid-2.0/README.md`](./solid-2.0/README.md)
- Stores RFC: [`./solid-2.0/04-stores.md`](./solid-2.0/04-stores.md)
- Async data RFC: [`./solid-2.0/05-async-data.md`](./solid-2.0/05-async-data.md) (relevant for Section 1.C)
- Reactivity RFC: [`./solid-2.0/01-reactivity-batching-effects.md`](./solid-2.0/01-reactivity-batching-effects.md) (relevant for F2/F4/F5)
- Per-codebase migration history: [`./MIGRATION-meowter-to-solid-2.0.md`](./MIGRATION-meowter-to-solid-2.0.md)
