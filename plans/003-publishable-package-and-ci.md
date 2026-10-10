# Plan 003: Make the published package match its `publishConfig`, and gate it in CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a1647dc..HEAD -- packages/meowter/vite.config.ts packages/meowter/package.json .github/workflows/`
> On any change, compare "Current state" against live code; mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (build config; nothing user-facing changes at runtime)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `a1647dc`, 2026-10-10

## Why this matters

`packages/meowter/package.json` `publishConfig` advertises four build
outputs, but `vite build` produces only two. Publishing today would ship a
package whose `meowter/codegen` and `meowter/vite-plugin` subpath imports and
the `meowter-routes` CLI bin all point at files that don't exist — i.e. the
codegen/type-safe-routes story (a headline feature) is broken for every
npm consumer. Separately, CI only runs on the `publish` branch (Pages deploy);
no workflow runs tests/typecheck on pushes to `main` or on PRs, so regressions
land silently.

## Current state

`packages/meowter/package.json` (relevant parts):

```json
  "bin": { "meowter-routes": "./src/codegen/cli.ts" },
  "files": ["dist", "src", "meowter.html-data.json", "custom-elements.json", "README.md"],
  "publishConfig": {
    "bin": { "meowter-routes": "./dist/cli.js" },
    "main": "./dist/meowter.js",
    "types": "./dist/index.d.ts",
    "exports": {
      ".":              { "types": "./dist/index.d.ts",       "import": "./dist/meowter.js" },
      "./codegen":      { "types": "./dist/codegen.d.ts",     "import": "./dist/codegen.js" },
      "./vite-plugin":  { "types": "./dist/vite-plugin.d.ts", "import": "./dist/vite-plugin.js" }
    }
  },
  "dependencies": { "node-html-parser": "^9.0.4", "tinyglobby": "^0.2.17" },
  "peerDependencies": { "@solidjs/signals": "^2.0.0-beta.10" },
```

`packages/meowter/vite.config.ts`:

```ts
  plugins: [dts({ include: ["src"], exclude: ["src/**/*.test.ts"], bundleTypes: true })],
  build: {
    target: "es2022",
    lib: { entry: resolve(import.meta.dirname, "src/index.ts"), formats: ["es"], fileName: "meowter" },
    rollupOptions: { external: ["@solidjs/signals"] },
  },
```

Current `dist/` after build: `index.d.ts`, `meowter.js` only.

Entry sources:

- `src/index.ts` — browser runtime (custom elements, router).
- `src/codegen/index.ts` — Node-only codegen API (re-exports both Vite plugins).
- `src/codegen/vite-plugin.ts` — HTML-route `.d.ts` Vite plugin.
- `src/codegen/cli.ts` — Node CLI, starts with `#!/usr/bin/env node`.

Codegen modules import `node:fs/promises`, `node:path`, `node:process`,
`tinyglobby`, `node-html-parser`, and `vite` (type-only). These must be
**external** in the build.

The only workflow is `.github/workflows/deploy-kitchensink.yml` (triggers:
`push` to `publish`, `workflow_dispatch`). It shows the repo's CI setup
conventions — reuse them exactly: `actions/checkout@v4`,
`pnpm/action-setup@v4`, `actions/setup-node@v4` with `node-version: 26` and
`cache: pnpm`, `pnpm install --frozen-lockfile`.

## Commands you will need

| Purpose     | Command (repo root)                          | Expected         |
| ----------- | -------------------------------------------- | ---------------- |
| Build lib   | `pnpm build:lib`                             | exit 0           |
| List dist   | `ls packages/meowter/dist`                   | see Step 2       |
| Pack dryrun | `cd packages/meowter && pnpm pack --dry-run` | lists dist files |
| Tests       | `pnpm test`                                  | all pass         |
| Typecheck   | `pnpm typecheck`                             | exit 0           |
| Format      | `pnpm fmt:check`                             | exit 0           |

## Scope

**In scope**:

- `packages/meowter/vite.config.ts`
- `packages/meowter/package.json` (only if a `publishConfig` path must be corrected to match real output — prefer changing the build, not the manifest)
- `.github/workflows/ci.yml` (create)
- `packages/meowter/scripts/check-pack.mjs` (create, optional — see Step 4)

**Out of scope**:

- `.github/workflows/deploy-kitchensink.yml` — leave untouched.
- Moving codegen into a separate package, or moving `node-html-parser`/`tinyglobby` to optional deps — a reasonable later decision, not this plan.
- Actually publishing to npm, version bumps, changelog tooling.
- Source changes in `src/`.

## Git workflow

- Branch `advisor/003-publishable-package-and-ci`; conventional commits, e.g. `build: Emit codegen, vite-plugin and cli entries` and `ci: Run tests and typecheck on PRs`. No push.

## Steps

### Step 1: Multi-entry library build

Change `build.lib` to an entry map and make Node/third-party imports external:

```ts
lib: {
  entry: {
    meowter: resolve(import.meta.dirname, "src/index.ts"),
    codegen: resolve(import.meta.dirname, "src/codegen/index.ts"),
    "vite-plugin": resolve(import.meta.dirname, "src/codegen/vite-plugin.ts"),
    cli: resolve(import.meta.dirname, "src/codegen/cli.ts"),
  },
  formats: ["es"],
},
rollupOptions: {
  external: [/^node:/, "@solidjs/signals", "vite", "tinyglobby", "node-html-parser"],
},
```

Vite 8 uses Rolldown; if it warns that `rollupOptions` is deprecated in favor
of `rolldownOptions`, follow the warning's suggested key name. With an entry
map, file names default to `[name].js`.

**Verify**: `pnpm build:lib` exits 0 and `ls packages/meowter/dist` includes `meowter.js codegen.js vite-plugin.js cli.js`.

### Step 2: Types for every entry

Inspect `dist/*.d.ts`. Required: `index.d.ts`, `codegen.d.ts`, `vite-plugin.d.ts`.
`vite-plugin-dts` with `bundleTypes: true` should emit one bundled `.d.ts`
per entry, named after the entry. If its names differ (e.g. `meowter.d.ts`
instead of `index.d.ts`), adjust with the plugin's options; only as last
resort edit `publishConfig.types`/`exports.*.types` to the real names.

Also check that `dist/index.d.ts` (or its equivalent) still contains
`interface RouteRegistry` — consumers augment it via `declare module "meowter"`.

**Verify**:

- `ls packages/meowter/dist/*.d.ts` lists files matching every `types` path in `publishConfig`.
- `grep -c "interface RouteRegistry" packages/meowter/dist/index.d.ts` → `1` (or ≥1).
- `grep -L "node:" packages/meowter/dist/meowter.js` prints the file (the browser bundle must not import Node builtins).

### Step 3: CLI is executable

**Verify**: `head -1 packages/meowter/dist/cli.js` → `#!/usr/bin/env node`.
If the hashbang was stripped, add it back for the `cli` chunk only (e.g.
`output.banner: (chunk) => chunk.name === "cli" ? "#!/usr/bin/env node" : ""`)
and ensure it's not duplicated. Then run
`node packages/meowter/dist/cli.js --help` → prints help, exit 0.

### Step 4: Pack check

Add a small Node script `packages/meowter/scripts/check-pack.mjs` that reads
`package.json`, collects every path under `publishConfig` (`main`, `types`,
`bin.*`, `exports.*.*`), and exits 1 listing any that doesn't exist on disk.
Add `"check:pack": "node scripts/check-pack.mjs"` to the package scripts.

**Verify**: `pnpm --filter meowter build && pnpm --filter meowter check:pack` → exit 0. Temporarily rename `dist/cli.js` → script exits 1 naming it; rename back.

### Step 5: CI workflow

Create `.github/workflows/ci.yml`:

- `on: push: branches: [main]` and `pull_request:`
- one job on `ubuntu-latest` with the same checkout/pnpm/node-26/cache/install steps as `deploy-kitchensink.yml`, then:
  `pnpm fmt:check`, `pnpm typecheck`, `pnpm test`, `pnpm build:lib`, `pnpm --filter meowter check:pack`, `pnpm build:kitchensink`.

**Verify**: run the same commands locally in order → all exit 0. (YAML validity: `node -e "require('node:fs').readFileSync('.github/workflows/ci.yml','utf8')"` is not a validator — if `actionlint` is installed, run it; otherwise review indentation carefully.)

## Test plan

No unit tests; the verification is the build/pack check (Step 4) plus CI.

## Done criteria

- [ ] `pnpm build:lib` exits 0; `dist/` contains `meowter.js`, `codegen.js`, `vite-plugin.js`, `cli.js` and the `.d.ts` files referenced by `publishConfig`
- [ ] `pnpm --filter meowter check:pack` exits 0
- [ ] `head -1 packages/meowter/dist/cli.js` is the node hashbang; `node packages/meowter/dist/cli.js --help` exits 0
- [ ] `dist/meowter.js` contains no `node:` import
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm fmt:check` exit 0
- [ ] `.github/workflows/ci.yml` exists with push(main)+pull_request triggers
- [ ] Only in-scope files modified (`dist/` is build output — confirm it's git-ignored with `git check-ignore packages/meowter/dist`; if NOT ignored, STOP)
- [ ] `plans/README.md` row updated

## STOP conditions

- `vite-plugin-dts` cannot emit per-entry bundled types after two configuration attempts — report what it does emit.
- The browser bundle `dist/meowter.js` pulls in codegen/Node code (shared chunk importing `node:`) — report; may need separate builds.
- `packages/meowter/dist` is tracked by git.

## Maintenance notes

- Every new public entry must be added in three places: `build.lib.entry`, `publishConfig.exports`, and (automatically checked) by `check:pack`.
- `node-html-parser` and `tinyglobby` are runtime `dependencies` but only codegen uses them; browser consumers download them needlessly. Consider moving codegen to `@meowter/codegen` or making them optional peers before 1.0.
- The peer range `@solidjs/signals ^2.0.0-beta.10` vs dev pin `2.0.0-rc.0`: pre-release ranges in semver only match the same `major.minor.patch` tuple's pre-releases, which is fine for now but should be updated to `^2.0.0` once Solid 2 ships stable.
