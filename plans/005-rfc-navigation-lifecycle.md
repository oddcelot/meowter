# Plan 005: Write the RFC for meowter's navigation lifecycle (guards, loaders, lazy routes, a11y)

> **Executor instructions**: This is a **design plan**, not a build plan. The
> deliverable is one Markdown RFC. Do not modify any file under `packages/`
> or `examples/`. Follow the steps; if a STOP condition occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a1647dc..HEAD -- packages/meowter/src/`
> If source changed, re-read the files listed in "Current state" before
> describing them in the RFC.

## Status

- **Priority**: P1 (strategic — the "next move" for a competitive router)
- **Effort**: M
- **Risk**: LOW (docs only)
- **Depends on**: none; ideally lands after 001–004 so the RFC describes fixed behavior
- **Category**: direction
- **Planned at**: commit `a1647dc`, 2026-10-10

## Why this matters

meowter today _matches_ URLs and shows/hides `<meow-route>` elements
synchronously. Every router considered best-in-class (TanStack Router, React
Router data APIs, SvelteKit, Vaadin Router, Angular) also owns the
**navigation transaction**: decide whether to go (guards/redirects), fetch
what the next view needs (loaders, with abort + pending/error states), load
the view's code lazily, then commit, restore scroll, move focus and announce
the change. Without this, apps built on meowter must re-implement it ad hoc,
and adding it later forces breaking changes to `navigate()` (currently
synchronous `void`) and to the event model. This is the single largest gap
between meowter and a viable 1.0, so it must be designed before more surface
area is added.

## Current state (inline facts the RFC must build on)

Package: `packages/meowter` — "Tiny custom-element router built on
`@solidjs/signals`" (Solid 2 RC reactive core, framework-agnostic).

Three ways to define routes, all converging on `<meow-router>` /
`<meow-outlet>` / `<meow-route>` custom elements:

1. **Declarative HTML**: `<meow-router><meow-outlet><meow-route path="/cats">…` (codegen `meowterRoutes()` Vite plugin emits a `RouteRegistry` `.d.ts` from HTML).
2. **Code**: `createRootRoute()`, `createRoute({ getParentRoute, path, render })`, `createRouter({ routeTree, basepath }).mount(el)` — TanStack-style typed tree; `router.navigate({ to: route, params, search, hash, state, replace })`.
3. **File routes**: `createFileRoute("/cats/:id")({ render })` in `src/routes/**/*.route.ts`; `meowterFileRoutes()` Vite plugin generates `routeTree.gen.ts`.

Key runtime facts (read these files to confirm):

- `src/router-element.ts` — `navigate(href, state)` and `replace()` are **synchronous**: `history.pushState` → set URL signal → `flush()` → dispatch `route-change`. Listens to `popstate` (back/forward) and captures `<a>` clicks via `src/link-intercept.ts`. Keeps an in-memory `history` store of entries keyed by an id stored in `history.state.__meowterHistoryId`. Uses the History API, not the Navigation API.
- `src/outlet-element.ts` — each outlet derives `selection` from the parent outlet's `remainder` (nested routing) via `selectFor()` in `src/path-select.ts`.
- `src/path-select.ts` — **first match in DOM/registration order** wins; `*` is a fallback; there is no specificity ranking at runtime. (The file-routes codegen sorts by specificity before emitting — `src/codegen/extract-file-routes.ts:176-195` — but HTML and code-defined trees are order-dependent.)
- `src/route-element.ts` — `activate()`/`deactivate()` toggle `hidden` and dispatch `route-match` / `route-leave` events. No way to veto or delay.
- `src/create-route.ts` `wireRender` — `render(ctx)` runs synchronously on `route-match`; returns `Node | string | null`. No async, no lazy import, no error boundary.
- Search params: `router.searchParams` is a `Record<string, string[]>` store; `setSearchParam(key, value, { history })`. Untyped (no schema/validation).
- Scroll, focus management and screen-reader announcement on navigation: **none**. View Transitions: none.
- Devtools: the Lit example (`examples/lit-kitchensink/src/routing-timeline.ts`) shows routing events in the Lit DevTools timeline — a differentiator worth preserving in the lifecycle's event design.
- Docs folder holds Solid 2 migration notes (`docs/solid-2.0/`, `docs/STORES-and-findings.md`); `docs/solid-2.0/05-async-data.md` and `06-actions-optimistic.md` describe Solid 2's async primitives (async memos, `isPending`, transitions) — the RFC should evaluate building loaders on them.

## Scope

**In scope**: create `docs/rfcs/0001-navigation-lifecycle.md` (create `docs/rfcs/`).

**Out of scope**: any code change; implementing a prototype in `packages/` (a throwaway spike in a scratch branch is allowed for answering a question, but must not be committed to this branch).

## Git workflow

- Branch `advisor/005-rfc-navigation-lifecycle`; commit `docs: Add navigation lifecycle RFC`. No push.

## Steps

### Step 1: Read the sources listed above

Read every file named in "Current state", plus `docs/solid-2.0/05-async-data.md`
and `06-actions-optimistic.md`. Write down (for the RFC's "Background"
section) any fact above that turns out to be wrong.

**Verify**: you can answer: "What does `navigate()` return, and when is `route-change` dispatched relative to `history.pushState`?"

### Step 2: Survey prior art (short)

For each of: **TanStack Router** (`beforeLoad`, `loader`, `pendingComponent`, `errorComponent`, search-param validation), **Vaadin Router** (`onBeforeEnter`/`onBeforeLeave`/`action` with `commands.redirect`/`prevent`, lazy `action: () => import()`), **@lit-labs/router**, and the browser **Navigation API** (`navigation.addEventListener("navigate", e => e.intercept({ handler }))`, `NavigateEvent.signal`, `navigation.transition`, `scroll: "after-transition"`, `focusReset`) plus **View Transitions** (`document.startViewTransition`), write 3–5 bullets on what it does and what meowter should borrow or avoid. Use current official docs (check the Navigation API's cross-browser support status as of today and cite the source).

**Verify**: RFC section "Prior art" exists with one subsection per item and a source link each.

### Step 3: Write the RFC

Use this outline (all sections required):

1. **Summary** — one paragraph.
2. **Goals / Non-goals** — non-goals must include SSR unless you argue otherwise.
3. **Background** — current behavior (from Step 1).
4. **The navigation transaction** — a state diagram (Mermaid) of: `idle → matching → guarding (may redirect/cancel) → loading (parallel per matched route, AbortSignal) → committing (URL+DOM) → settled`, including what happens when a second navigation interrupts the first, and for back/forward (`popstate`) where the URL has already changed.
5. **API proposal** for all three route-definition styles. At minimum specify:
   - route options: `beforeLoad(ctx)` (can `throw redirect({ to })` / return `false`), `loader(ctx)` with `{ params, search, signal }`, `component`/`render` receiving loader data as an accessor, `pending`, `error`, and `lazy: () => import(...)`.
   - declarative HTML equivalent (e.g. a `navigate` cancelable event on `<meow-router>`, a `loader` property on `<meow-route>`) — must not require a framework.
   - return type of `router.navigate()` (e.g. `Promise<NavigationResult>`) and how this stays backwards compatible or is a documented breaking change pre-1.0.
   - event model: new events (e.g. `navigate-start`, `navigate-end`, `navigate-error`) and how DevTools timeline consumes them.
6. **Matching** — propose ranked matching (static > param > splat, then segment count) applied uniformly to all three styles, vs keeping DOM order; state migration impact.
7. **Typed search params** — schema hook (evaluate Standard Schema `~standard` interface so Zod/Valibot/ArkType all work) and how it plugs into `router.searchParams`.
8. **Accessibility & UX** — scroll restoration per history entry (the history store already has per-entry ids), focus target after navigation, live-region announcement, View Transitions opt-in.
9. **Navigation API vs History API** — recommend one, with a fallback strategy.
10. **Phased rollout** — 3–5 phases each small enough for one PR, ordered so each ships value alone (suggested first phase: async-aware `navigate()` + `navigate-start/end` events + scroll/focus, no loaders).
11. **Open questions** — anything you could not decide; each with a recommended default.

**Verify**: `grep -c "^## " docs/rfcs/0001-navigation-lifecycle.md` → ≥ 11. The Mermaid block is fenced as ```mermaid.

### Step 4: Self-check

Re-read the RFC as someone who has never seen meowter: every API is shown
with a code example for at least the code-defined style and the HTML style;
every claim about current behavior names a file.

**Verify**: `pnpm fmt:check` → exit 0 (oxfmt also checks Markdown here; if it reports the RFC, run `pnpm fmt -- docs/rfcs/0001-navigation-lifecycle.md` — this formats only that file).

## Done criteria

- [ ] `docs/rfcs/0001-navigation-lifecycle.md` exists with all 11 sections
- [ ] Prior-art section cites a source URL for each surveyed item
- [ ] Phased rollout lists ≥3 phases, each with scope and acceptance criteria
- [ ] `git status` shows only the new RFC (and `plans/README.md`)
- [ ] `pnpm fmt:check` exits 0
- [ ] `plans/README.md` row updated

## STOP conditions

- You find that `navigate()` is already async or that a guard/loader mechanism already exists — report; the premise is wrong.
- Answering a design question seems to require changing code on this branch.

## Maintenance notes

The RFC is the input for follow-up build plans (one per rollout phase). Plans
002 and 004 interact: param decoding errors and the per-route reactive scope
should become part of the transaction (validation errors → `error` state;
loader + render share the scope that is disposed on leave/abort).
