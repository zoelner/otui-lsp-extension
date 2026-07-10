# OTUI Language Support

Editor support for **OTUI/OTML** (`.otui` / `.otmod` / `.otfont`), the UI markup language of the
OTClient game client.

Works in **VS Code** and in the VS Code–compatible editors — **Cursor**, **Antigravity**,
**Windsurf** and **VSCodium** — which install extensions from [Open VSX](https://open-vsx.org).

This extension contains **no language logic**. It launches the
[`otui-lsp`](https://github.com/zoelner/otui-lsp) server binary and speaks LSP to it over stdio;
all the intelligence lives in the server.

## Install

Install *OTUI Language Support* from your editor's extension panel. The published packages are
**platform-specific**: each one bundles the `otui-lsp` binary for your OS and CPU, so there is
nothing else to install and no Rust toolchain required.

| Editor | Registry |
|---|---|
| VS Code | Visual Studio Marketplace |
| Cursor, Antigravity, Windsurf, VSCodium | Open VSX |

Open a **folder**, not a single file — the server indexes `.otui` files across the workspace, which
is what lets references, rename and type hierarchy resolve into files you have not opened.

### Using your own server build

If you build `otui-lsp` yourself, point the extension at it:

```jsonc
// settings.json
"otui.server.path": "~/workspace/otui-lsp/target/release/otui-lsp"
```

The binary is resolved in this order, and an explicit `otui.server.path` that does not exist is a
hard error rather than a silent fallback:

1. `otui.server.path`
2. the binary bundled inside the extension
3. `otui-lsp` on your `PATH`

## Features

Diagnostics, completion (properties / `$state` / anchors / `@events`), hover, go-to-definition,
type definition / implementation / **type hierarchy** (the `Name < Base` graph), find references,
rename, document & workspace symbols, semantic highlighting, **color swatches**, **clickable asset
links** (`image-source:`), folding, document/range formatting, and document highlight — all
resolving **workspace-wide** across closed files.

Syntax highlighting comes from two layers: a TextMate grammar colors the file the moment it opens,
and the server's semantic tokens refine it once the language server attaches. Embedded Lua in
`@event:`, `!expr:` and `&alias:` values is highlighted with the editor's Lua grammar.

## Settings

| Setting | Default | Description |
|---|---|---|
| `otui.server.path` | *(unset)* | Absolute path to an `otui-lsp` binary. Supports `~` and `${workspaceFolder}`. |
| `otui.trace.server` | `off` | Trace LSP traffic for debugging (`off` / `messages` / `verbose`). |

## Commands

| Command | Description |
|---|---|
| **OTUI: Restart Language Server** | Restart `otui-lsp` without reloading the window. |
| **OTUI: Show Language Server Output** | Open the server's log channel. |

## Development

Requires the current Node LTS (see `.nvmrc`).

```bash
npm install
npm run check     # typecheck
npm test          # grammar + binary-resolution tests
npm run build     # bundle to dist/ with esbuild
```

Press **F5** to launch an Extension Development Host with `sample/` open. Have `otui-lsp` on your
`PATH`, or set `otui.server.path`.

### Version pinning, on purpose

Three dependencies are deliberately held at a floor rather than kept latest, because they describe
the **oldest** editor we support — and the forks lag upstream VS Code:

- `engines.vscode` — the oldest editor that can install the extension.
- `@types/vscode` — pinned **exactly** (no caret). A caret would resolve to the newest types and let
  us compile against APIs that the floor does not have.
- esbuild's `target` — the extension host's Node, not the Node we build with.

`npm run check` is what enforces this: it typechecks against the floor's API surface.

### Releasing

Releases are cut by tag. `.github/workflows/release.yml` builds `otui-lsp` natively for six target
platforms, packages one VSIX per platform, and publishes to **both** registries.

```bash
git tag v0.1.0 && git push --tags
```

The server revision that gets built is pinned by `otuiLsp.ref` in `package.json`.

One-time setup:

- Create a Visual Studio Marketplace publisher and store a PAT as the `VSCE_PAT` secret.
- Create the Open VSX namespace (`npx ovsx create-namespace zoelner`) and store a PAT as `OVSX_PAT`.

## License

Dual-licensed under either [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option —
matching the server.
