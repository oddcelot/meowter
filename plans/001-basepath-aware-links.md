# Plan 001: Make `createLink` and `<meow-link>` basepath-aware (href + active state)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a1647dc..HEAD -- packages/meowter/src/router-element.ts packages/meowter/src/link.ts packages/meowter/src/link.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a1647dc`, 2026-10-10

## Why this matters

meowter supports mounting under a sub-path (`basepath`, e.g. GitHub Pages at
`/meowter/`). Navigation (`navigate`/`replace`) prepends the basepath, but the
two link APIs do not:

1. The rendered `<a href>` lacks the basepath (`/cats` instead of `/x/cats`).
   Plain left-click still works (the router intercepts and prepends), but
   cmd/ctrl-click "open in new tab", middle-click, "copy link address", and
   crawlers all get a URL outside the app → 404.
2. Active state compares the link target (no basepath) against
   `router.currentURL().pathname` (with basepath), so under a basepath a link
   is **never** marked active (`aria-current="page"` never set).

The vanilla kitchensink example works around this by hand
(`examples/kitchensink/main.ts:30-33` `stripBase`, and `:86-101`
`bindNavActiveState` reads `r.matchURL()`), which is evidence the core is
missing it. The Lit kitchensink uses `<meow-link>` with
`<meow-router basepath=${import.meta.env.BASE_URL}>` and is affected.

## Current state

Files:

- `packages/meowter/src/router-element.ts` — `<meow-router>`; owns URL signal, basepath, `navigate`/`replace`.
- `packages/meowter/src/link.ts` — `createLink()` (typed link handle) and `<meow-link>` element.
- `packages/meowter/src/link.test.ts` — tests for both link APIs.

`router-element.ts` — basepath helpers already exist (private):

```ts
// router-element.ts:118-130
  matchURL: Accessor<URL> = () => {
    const url = this.#url[0]();
    const bp = this.#basepath[0]();
    if (bp === "/") return url;
    const stripped = stripBasepath(url.pathname, bp);
    ...
  };

// router-element.ts:138-153
  #prependBasepath(href: string): string {
    const bp = this.#basepath[0]();
    if (bp === "/") return href;
    if (href.startsWith("#") || href.startsWith("?")) return href;
    let url: URL;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return href;
    }
    if (url.origin !== window.location.origin) return href;
    const noTrail = bp.slice(0, -1);
    if (url.pathname === noTrail || url.pathname.startsWith(bp)) return url.href;
    url.pathname = bp + url.pathname.replace(/^\//, "");
    return url.href;
  }
```

Note `#prependBasepath` is **idempotent** (an href already under the basepath
is returned unchanged). That is what makes it safe to put the prefixed href on
the anchor: clicks re-enter `navigate()` which calls `#prependBasepath` again
and gets the same value.

`link.ts` — `createLink`:

```ts
// link.ts:66-87
export function createLink(router: Router<AnyRoute>, opts: any): LinkHandle {
  const href = computeHref(opts as NavigateRouteOptions<AnyRoute>);
  const targetPath = pathnameOf(href);
  const exact = opts.activeOptions?.exact ?? false;
  ...
  const isActive = createMemo<boolean>(() => {
    const current = router.currentURL().pathname;   // <-- includes basepath
    if (exact) return current === targetPath;
    if (targetPath === "/") return current === "/";
    return current === targetPath || current.startsWith(targetPath + "/");
  });

  return { href, onClick, isActive };               // <-- href lacks basepath
}
```

`router` here is the `Router` object from `create-route.ts`; `router.element`
is the `MeowRouter | null` (null until `router.mount()` is called).

`link.ts` — `<meow-link>`: `#update()` (around line 250) sets
`anchor.setAttribute("href", computeHref(...))`; `#refreshActive()` (around
line 268) reads `untrack(() => router.currentURL().pathname)` and compares to
`pathnameOf(anchor.getAttribute("href"))`. The `replace`-mode click handler
(around line 207) calls `this.#router?.replace(anchor.getAttribute("href")!, this.#state)`.

Conventions: private fields with `#`, small pure helpers at module top,
`untrack` around reads in non-reactive code. Tests use vitest + happy-dom,
`setURL()`/`tick()` from `src/test-helpers.ts`; see the existing
`describe("<meow-link> custom element")` block in `link.test.ts:177-229` as the
pattern.

## Commands you will need

| Purpose   | Command (from repo root)                                 | Expected on success             |
| --------- | -------------------------------------------------------- | ------------------------------- |
| Tests     | `pnpm test`                                              | all pass (151 before this plan) |
| One file  | `pnpm --filter meowter exec vitest run src/link.test.ts` | all pass                        |
| Typecheck | `pnpm typecheck`                                         | exit 0                          |
| Format    | `pnpm fmt:check`                                         | exit 0                          |

## Scope

**In scope**:

- `packages/meowter/src/router-element.ts` (add one public method; refactor `#prependBasepath` to use it)
- `packages/meowter/src/link.ts`
- `packages/meowter/src/link.test.ts`

**Out of scope**:

- `examples/kitchensink/main.ts` workaround (`stripBase`, `bindNavActiveState`) — leave it; removing it is a separate follow-up once this lands.
- `computeHref` / `router.buildHref` in `create-route.ts` — keep them basepath-free. They produce _route_ paths; `navigate()` adds the basepath. Changing them would double-apply in user code that already passes the result to `navigate`.
- Reacting to a _runtime change_ of `basepath` in links (rare; see Maintenance notes).

## Git workflow

- Branch: `advisor/001-basepath-aware-links`
- Conventional commits, matching history, e.g. `fix: Make links basepath-aware`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add a public `withBasepath(href)` to `MeowRouter`

In `router-element.ts`, add a public method that returns a **same-origin
relative** href (`pathname + search + hash`) with the basepath prefixed,
idempotently. Implement it using the same logic as `#prependBasepath`, and make
`#prependBasepath` delegate to it where possible. Target shape:

```ts
  /**
   * Prefix a same-origin href with the router's basepath (idempotent).
   * Returns `pathname + search + hash`. Cross-origin, `#…`, and `?…` hrefs
   * are returned unchanged.
   */
  withBasepath(href: string): string {
    const bp = this.#basepath[0]();
    if (bp === "/" || href.startsWith("#") || href.startsWith("?")) return href;
    let url: URL;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return href;
    }
    if (url.origin !== window.location.origin) return href;
    const noTrail = bp.slice(0, -1);
    if (!(url.pathname === noTrail || url.pathname.startsWith(bp))) {
      url.pathname = bp + url.pathname.replace(/^\//, "");
    }
    return url.pathname + url.search + url.hash;
  }
```

Keep `#prependBasepath`'s existing return contract (it returns `url.href`, an
absolute URL, and callers pass it to `new URL(...)`). Simplest: leave
`#prependBasepath` as is, or rewrite it as
`return new URL(this.withBasepath(href), window.location.href).href` only if
all existing basepath tests still pass.

**Verify**: `pnpm --filter meowter exec vitest run src/basepath.test.ts` → all pass.

### Step 2: Fix `createLink`

In `link.ts` `createLink`:

- Keep `const rawHref = computeHref(...)` and `const targetPath = pathnameOf(rawHref)` (unprefixed route path — used for active comparison).
- Make `href` on the returned handle a **getter** so it reflects the basepath once the router is mounted:
  `get href() { return router.element ? router.element.withBasepath(rawHref) : rawHref; }`
  (The `LinkHandle.href` interface member is `readonly href: string`; a getter satisfies it.)
- In `isActive`, compare against the basepath-stripped URL:
  `const current = router.element ? router.element.matchURL().pathname : router.currentURL().pathname;`

Do not change `onClick` — it calls `router.navigate(opts)`, which already prepends.

**Verify**: `pnpm --filter meowter exec vitest run src/link.test.ts` → all existing tests pass.

### Step 3: Fix `<meow-link>`

In `link.ts` `MeowLink`:

- Add a private field `#targetPath: string | null` holding the unprefixed pathname.
- In `#update()`: compute `const raw = computeHref(...)`, set `this.#targetPath = pathnameOf(raw)`, and set
  `anchor.setAttribute("href", router ? router.withBasepath(raw) : raw)` where
  `router = this.#router ?? this.closest<MeowRouter>("meow-router")`. When `computeHref` throws, also set `#targetPath = null`.
- In `#refreshActive()`: use `#targetPath` (not the anchor's href) as the target, and
  `untrack(() => router.matchURL().pathname)` as `current`. Keep the existing exact/`"/"`/prefix logic. If `#targetPath` is null, clear active attributes.
- `connectedCallback` sets `this.#router` before calling `#update()` — confirm this order is preserved so the first render already has the prefix.
- The replace-mode click handler passes the anchor href (now prefixed) to `router.replace`; that is fine because prepending is idempotent. Do not change it.

**Verify**: `pnpm --filter meowter exec vitest run src/link.test.ts` → all existing tests pass.

### Step 4: Add basepath tests

Add `describe("links under a basepath", ...)` to `link.test.ts`. Build the
router like `buildRouter()` but with `basepath: "/x/"` and `setURL("/x/")` in
the test (`beforeEach` already resets to `/`). Cases:

1. `createLink(router, { to: catsRoute }).href` → `"/x/cats"`.
2. `createLink(...).isActive()` is `false` at `/x/`, `true` after `router.navigate("/cats")` + `await tick()` (location `/x/cats`), `false` after `router.navigate("/")`.
3. `<meow-link to="/cats">` inside the router renders `a[href="/x/cats"]`.
4. `<meow-link to="/cats">` gets `aria-current="page"` after `router.navigate("/cats")`; loses it after `router.navigate("/")`.
5. `<meow-link exact to="/">` is active at `/x/` (i.e. `matchURL` pathname `/`).
6. Clicking the `<meow-link>` anchor (dispatch a primary-button `MouseEvent("click", {bubbles:true, cancelable:true, button:0})`) ends at `window.location.pathname === "/x/cats"` — **not** `/x/x/cats` (idempotency guard).
7. `<meow-link replace to="/cats">` click → `window.location.pathname === "/x/cats"`.

**Verify**: `pnpm test` → all pass, 7 new tests included.

## Test plan

See Step 4. Pattern: existing `<meow-link>` tests in `link.test.ts:177-229`
and the basepath setup in `basepath.test.ts`.

## Done criteria

- [ ] `pnpm test` exits 0; ≥7 new tests in `link.test.ts` under a basepath describe block
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm fmt:check` exits 0
- [ ] `grep -n "withBasepath" packages/meowter/src/router-element.ts` shows the new public method
- [ ] `git status` shows only the three in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any existing test in `basepath.test.ts` or `link.test.ts` starts failing and the fix would require changing `computeHref` / `buildHref` semantics.
- Test case 6 navigates to a double-prefixed path (`/x/x/cats`) and the cause is not in `link.ts` / `withBasepath` — means the idempotency assumption is false.
- `router.element` is `null` in the `createLink` tests after `router.mount()` — means the Router lifecycle differs from this plan's assumption.

## Maintenance notes

- If basepath is changed at runtime, `<meow-link>` hrefs won't refresh until their `to`/`params` change. Acceptable today; if needed, listen for a basepath change in `#update()`.
- `createLink.isActive` reads `router.element` non-reactively; a link created _before_ `router.mount()` falls back to `currentURL()` forever. Document "create links after mount" or, later, make `element` a signal.
- After landing, the kitchensink `stripBase` workaround can be deleted (follow-up).
