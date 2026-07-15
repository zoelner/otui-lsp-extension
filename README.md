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
links** (`image-source:`), inlay hints, folding, document/range formatting, and document highlight —
all resolving **workspace-wide** across closed files.

A style that others derive from carries a **code lens** — *`3 widget(s) inherit this style`* — and
clicking it peeks the inheriting widgets.

Syntax highlighting comes from two layers: a TextMate grammar colors the file the moment it opens,
and the server's semantic tokens refine it once the language server attaches. Embedded Lua in
`@event:`, `!expr:` and `&alias:` values is highlighted with the editor's Lua grammar.

## Settings

| Setting | Default | Description |
|---|---|---|
| `otui.server.path` | *(unset)* | Absolute path to an `otui-lsp` binary. Supports `~` and `${workspaceFolder}`. |
| `otui.lua.enable` | `true` | Attach the server to `.lua` files for the Lua→OTUI go-to-definition bridge (see below). |
| `otui.trace.server` | `off` | Trace LSP traffic for debugging (`off` / `messages` / `verbose`). |

## The Lua ↔ OTUI bridge

An OTClient module is two files: `foo.otui` draws the UI and names elements (`id: closeButton`),
`foo.lua` drives it (`getChildById('closeButton')`). With the bridge on, **Go to Definition** on a
`getChildById('id')` in a `.lua` jumps to the matching `id:` in the `.otui` — including ids the
widget **inherits** from a base style in another file (e.g. a `MiniWindow`'s `closeButton`).

The server serves *only* definition on Lua files — never diagnostics, completion or hover, which
stay with your Lua language server. Both go-to-definition results (the Lua target and the `.otui`
declaration) show side by side; that is the feature, not a conflict. Runtime-built ids
(`'row_' .. i`) have no static target and intentionally resolve to nothing.

Turn the bridge off with `"otui.lua.enable": false` to skip indexing the workspace's Lua files.

## Commands

| Command | Description |
|---|---|
| **OTUI: Restart Language Server** | Restart `otui-lsp` without reloading the window. |
| **OTUI: Show Language Server Output** | Open the server's log channel. |

## Troubleshooting

When something looks wrong, the first move is **OTUI: Show Language Server Output** — the log names
which binary was launched, where it came from, and whether the server handshake completed. For a
deeper look, set `"otui.trace.server": "verbose"` to see the LSP traffic itself.

| Symptom | Cause & fix |
|---|---|
| **Nothing lights up — no diagnostics, no completion.** | You opened a single file. The server indexes across the workspace and the extension only activates on a folder that *contains* a `.otui`. Open the **folder** (`File → Open Folder`), not the file. |
| **"Could not find the otui-lsp language server."** | No bundled binary and none on `PATH`. Either install a platform-specific package (which bundles one) or set `otui.server.path` to a binary you built. A path that is *set but missing* is a hard error by design — it never silently falls back. |
| **Colors look flat or washed-out** once the file finishes loading. | You have `"editor.semanticHighlighting.enabled": false` in your settings. That flag turns off the server's semantic tokens, leaving only the coarser TextMate layer — which reads as "the colors got worse". Remove the flag; the two layers are meant to work together. |
| **On Windows the extension installs but never loads.** | `code --install-extension foo.vsix` from the CLI can register the package without activating it. Install through the UI instead: **Extensions → `⋯` → Install from VSIX**. |
| **Everything is disabled and the editor mentions "Restricted Mode".** | The extension launches a native binary, so it declares itself unsupported in untrusted workspaces and stays off until you **trust the folder** (the banner's *Trust* button, or `Workspaces: Manage Workspace Trust`). |
| **The log shows `[error] otui-lsp: indexed 221 workspace .otui file(s)`.** | Not an error. The server writes progress to stderr on purpose (it is shutdown-safe), and the client surfaces any stderr at error level. A line like this means indexing *succeeded*. |

Language behavior itself — a wrong diagnostic, a missing completion, a go-to-definition that lands
in the wrong place — is the **server's** domain, not this client's. Those belong in the
[`otui-lsp`](https://github.com/zoelner/otui-lsp/issues) tracker.

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
