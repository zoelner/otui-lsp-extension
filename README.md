# OTUI Language Support (VS Code)

A thin VS Code client for the [`otui-lsp`](https://github.com/zoelner/otui-lsp) language server —
language intelligence for **OTUI/OTML** (`.otui` / `.otmod` / `.otfont`), the UI markup language of
the OTClient game client.

This extension contains **no language logic** — it just launches the `otui-lsp` server binary and
speaks LSP to it. All the smarts (diagnostics, completion, hover, go-to-definition, references,
rename, type hierarchy, color swatches, asset links, formatting, …) live in the server.

## Prerequisites

Build the server from the `otui-lsp` repo:

```bash
cd /path/to/otui-lsp
cargo build --release      # produces target/release/otui-lsp
```

## Point the extension at the binary

Either put `otui-lsp` on your `PATH`, or set the path in your VS Code settings:

```jsonc
// settings.json
"otui.server.path": "/absolute/path/to/otui-lsp/target/release/otui-lsp"
```

## Run it (from source, no packaging)

```bash
cd otui-vscode-extension
npm install                # pulls vscode-languageclient
```

Then open this folder in VS Code and press **F5** — that launches an *Extension Development Host*
with the extension loaded. Open a folder containing `.otui` files (open the **folder**, not a single
file, so the server can index the whole workspace) and start editing.

## Package it (optional, to install as a .vsix)

```bash
npm install -g @vscode/vsce
vsce package               # produces otui-vscode-extension-0.0.1.vsix
code --install-extension otui-vscode-extension-0.0.1.vsix
```

## What you get

Diagnostics, completion (properties / `$state` / anchors / `@events`), hover, go-to-definition,
type definition / implementation / **type hierarchy** (the `Name < Base` graph), find references,
rename, document & workspace symbols, semantic highlighting, **color swatches** (`#rgb`/`rgb()`/named
colors in color properties), **clickable asset links** (`image-source:`), folding, document/range
formatting, and document highlight — all resolving **workspace-wide** across closed `.otui` files.

## Settings

| Setting | Default | Description |
|---|---|---|
| `otui.server.path` | `otui-lsp` | Path to the `otui-lsp` binary (on `PATH`, or an absolute path to a local build). |
| `otui.trace.server` | `off` | Trace LSP traffic for debugging (`off` / `messages` / `verbose`). |

## License

Dual-licensed under either [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option —
matching the server.
