# Plan 002: Don't crash routing on malformed percent-encoding in URL params

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a1647dc..HEAD -- packages/meowter/src/path-compile.ts packages/meowter/src/path-compile.test.ts packages/meowter/src/outlet-element.test.ts`
> On any change, compare "Current state" against live code; mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a1647dc`, 2026-10-10

## Why this matters

`extractParams` calls `decodeURIComponent` on every captured `:param`. That
function throws `URIError` on malformed input such as `/cats/%E0` or
`/cats/100%`. The call runs inside the outlet's `selection` memo
(`outlet-element.ts` → `selectFor` → `extractParams`), so any user-typed or
externally linked bad URL throws inside reactive code and the outlet never
renders — the app shows a blank route instead of the matched route or the
404 (`*`) route. Anyone can trigger it by editing the address bar.

## Current state

- `packages/meowter/src/path-compile.ts` — compiles route patterns, extracts params.
- `packages/meowter/src/path-select.ts` — `selectFor()` calls `extractParams` on exact and prefix matches.

```ts
// path-compile.ts:56-62
export function extractParams(cp: CompiledPath, match: RegExpExecArray): Record<string, string> {
  const params: Record<string, string> = {};
  cp.paramNames.forEach((name, i) => {
    const v = match[i + 1];
    if (v !== undefined) params[name] = decodeURIComponent(v);
  });
  return params;
}
```

Test style: plain vitest `describe/it/expect`, see `path-compile.test.ts:1-30`.
Outlet integration tests live in `outlet-element.test.ts` (use `mountRouter`, `setURL`, `tick` from `test-helpers.ts`).

## Commands you will need

| Purpose   | Command (repo root)                                              | Expected |
| --------- | ---------------------------------------------------------------- | -------- |
| Tests     | `pnpm test`                                                      | all pass |
| One file  | `pnpm --filter meowter exec vitest run src/path-compile.test.ts` | all pass |
| Typecheck | `pnpm typecheck`                                                 | exit 0   |
| Format    | `pnpm fmt:check`                                                 | exit 0   |

## Scope

**In scope**: `packages/meowter/src/path-compile.ts`, `packages/meowter/src/path-compile.test.ts`, `packages/meowter/src/outlet-element.test.ts`.

**Out of scope**: `path-select.ts` matching logic; `computeHref` encoding in `create-route.ts`; search-param decoding (`URLSearchParams` already tolerates malformed input).

## Git workflow

- Branch `advisor/002-malformed-param-decoding`; commit e.g. `fix: Tolerate malformed percent-encoding in route params`. No push.

## Steps

### Step 1: Write the failing tests first

In `path-compile.test.ts` add:

- `extractParams` on `compilePath("/cats/:id")` with `exec("/cats/%E0")` returns `{ id: "%E0" }` (raw value, no throw).
- `exec("/cats/100%")` → `{ id: "100%" }`.
- Well-formed still decodes: `exec("/cats/a%20b")` → `{ id: "a b" }`.

**Verify**: `pnpm --filter meowter exec vitest run src/path-compile.test.ts` → the two malformed cases FAIL with `URIError`. (If they pass, STOP — the finding is wrong.)

### Step 2: Make decoding safe

Add a module-local helper in `path-compile.ts` and use it in `extractParams`:

```ts
function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
```

**Verify**: same command → all pass.

### Step 3: Integration test

In `outlet-element.test.ts`, add a test: `setURL("/cats/%E0")`, mount
`<meow-outlet><meow-route path="/cats/:id"></meow-route></meow-outlet>` via
`mountRouter`, `await tick()`, assert the route element's `matched === true`
and `params` equals `{ id: "%E0" }`. Copy the structure of an existing
param-matching test in that file.

**Verify**: `pnpm test` → all pass.

## Done criteria

- [ ] `pnpm test` exits 0 with ≥4 new tests
- [ ] `pnpm typecheck` and `pnpm fmt:check` exit 0
- [ ] `grep -n "safeDecode" packages/meowter/src/path-compile.ts` matches
- [ ] Only in-scope files modified
- [ ] `plans/README.md` row updated

## STOP conditions

- Step 1 malformed tests pass before the fix.
- The integration test still shows an unmatched route after the fix (means the throw is elsewhere — report where).

## Maintenance notes

Returning the raw string (rather than routing to 404) is a deliberate choice:
the route still matches and the app can validate the param itself. If typed
param parsing/validation is added later (see plan 005 design), revisit this to
surface a validation error instead.
