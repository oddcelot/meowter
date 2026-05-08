# Meowter — Zed extension

Wires `meowter-lsp` into Zed so route-path autocomplete works in HTML
(`<a href="…">`) and TS (`router.navigate("…")`) files.

## Prerequisites

1. Build the LSP bundle:

    ```sh
    pnpm --filter meowter-lsp build
    ```

   This produces `packages/meowter-lsp/dist/server.js` (the executable
   the extension launches).

2. The extension itself is built once via `cargo`:

    ```sh
    rustup target add wasm32-wasip1
    cd extensions/zed
    cargo build --release --target wasm32-wasip1
    ```

   Zed will rebuild on its own on first install — this step is just to
   make sure your toolchain is ready (Rust 1.85+ for `edition2024`
   transitive deps).

## Install in Zed (dev mode)

1. Open the meowter workspace in Zed.
2. Command palette → **`zed: install dev extension`**.
3. Select the `extensions/zed/` directory in the prompt.
4. Reload the window (Cmd-Shift-P → **`workspace: reload`**).

Verify by opening `examples/kitchensink/index.html` and typing
`<a href="`. The dropdown should include the registered route paths.

## How it works

- `extension.toml` declares one language server (`meowter-lsp`) attached
  to HTML, TypeScript, TSX, and JavaScript.
- `src/lib.rs` returns the launch command on every workspace open. The
  command is `node <worktree-root>/packages/meowter-lsp/dist/server.js
  --stdio`, with `MEOWTER_LSP_LOG=1` set so the server appends to
  `/tmp/meowter-lsp.log` for debugging.
- The actual completion logic lives in `packages/meowter-lsp/`. This
  extension is just the Zed-side wiring.

## Updating

After changing the LSP source in `packages/meowter-lsp/`:

```sh
pnpm --filter meowter-lsp build
```

Then **`zed: restart language server`** in the command palette (or
reload the window). No need to rebuild the extension itself — it only
launches the bundled JS.
