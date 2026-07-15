# Architecture

This extension is one half of a two-repository system. Knowing where the line falls is the single
most useful thing to understand before changing anything here.

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│  otui-lsp-extension  (this)  │  stdio  │  otui-lsp  (the other repo)  │
│  — the language client       │◄───────►│  — the language server       │
│  TypeScript, runs in VS Code │   LSP   │  Rust, a native binary       │
└─────────────────────────────┘         └──────────────────────────────┘
```

- **This repo is a thin client.** It declares the `otui` language, ships a TextMate grammar for
  coloring, resolves and launches the server binary, and speaks LSP to it over stdio. It contains
  **no language logic**.
- **[`otui-lsp`](https://github.com/zoelner/otui-lsp) is the server.** Every piece of intelligence —
  diagnostics, completion, hover, go-to-definition, references, rename, type hierarchy, color
  swatches, asset links, formatting, semantic tokens — lives there, in Rust.

The practical rule that follows: **new language features almost always belong in the server.** If a
change would compute something about OTUI code, it goes to `otui-lsp`. This client only routes
documents to the server and adapts a handful of results back into VS Code's API.

## Why the split

VS Code's `contributes.grammars` accepts **TextMate** grammars only. The server's grammar is a
**tree-sitter** grammar compiled into Rust, which the editor cannot consume — so there is nothing to
reuse there. The real reuse is the server's **semantic tokens**, which this client surfaces through
the LSP semantic-tokens request. That is why coloring arrives in two layers (see below).

Keeping the analysis in one Rust server also means every LSP client — this extension, Neovim,
Helix, anything — gets identical behavior. Editor-specific glue stays in each client; the language
truth stays in one place.

## The two coloring layers

Syntax highlighting is deliberately layered, and the layers can appear to fight if you do not know
they exist:

1. **TextMate grammar** (`syntaxes/otui.tmLanguage.json`) — static, instant. It colors a file the
   moment it opens, before the server has attached, and remains the only coloring if the server
   never starts. It also delegates embedded Lua in `@event:` / `!expr:` / `&alias:` values to the
   editor's Lua grammar.
2. **LSP semantic tokens** — from the server, once it attaches. These *refine* the TextMate layer:
   the server distinguishes things TextMate cannot (a native `UI*` base vs a file-defined base, a
   known `$state` vs an unknown one). The extension maps each server token kind to a TextMate scope
   in `contributes.semanticTokenScopes`, so the theme colors both layers consistently.

If a user sets `"editor.semanticHighlighting.enabled": false`, layer 2 is switched off and only the
coarser layer 1 remains — which reads as "the colors got worse". That is the most common coloring
confusion; see the README's Troubleshooting.

## The client lifecycle (`src/extension.ts`)

1. **Activation.** `activationEvents: ["workspaceContains:**/*.otui"]` — the client starts when a
   workspace contains any `.otui`. It is intentionally *not* activated by opening a `.lua`, so it
   stays dormant in Lua projects that have nothing to do with OTClient.
2. **Server resolution** (`src/server.ts`). The binary is resolved in a fixed order:
   `otui.server.path` → the binary bundled in the VSIX (`server/otui-lsp`) → `otui-lsp` on `PATH`.
   An `otui.server.path` that is set but missing is a **hard error**, never a silent fallback to
   another binary.
3. **Client construction.** A `LanguageClient` is built with stdio transport. Its id **must** be
   `otui`: `vscode-languageclient` reads its trace level from `<id>.trace.server`, so any other id
   would silently disable `otui.trace.server`.
4. **Document selector & watchers.** The client registers for `otui` documents, plus `lua` documents
   when the bridge is on (below). File watchers feed the server `workspace/didChangeWatchedFiles` so
   it re-indexes files that change on disk while closed — this is what makes references, rename and
   type hierarchy resolve across files no editor has open.

Changing `otui.server.path` or `otui.lua.enable` restarts the client, because both are baked in at
construction time (the binary to spawn and the document selector).

## The Lua ↔ OTUI bridge

An OTClient module is two files: `foo.otui` names widgets (`id: closeButton`) and `foo.lua` drives
them (`getChildById('closeButton')`). When `otui.lua.enable` is on, the client also attaches the
server to `.lua` files, so **Go to Definition** on a `getChildById('id')` jumps to the matching
`id:` in the `.otui` — including inherited ids resolved by the server across style files.

The server serves **only** definition on Lua. To enforce that contract from the client side, the
extension installs a `middleware.handleDiagnostics` that drops any diagnostics the server might emit
for a `.lua` URI. This means even a server without its own language guard can never spray OTUI parse
errors over valid Lua. It filters only *our* server's diagnostics; the user's Lua language server
publishes through its own client and is untouched.

## Client-side command adaptation (`otui.showSubtypes`)

The server emits a code lens — *`N widget(s) inherit this style`* — carrying a command it cannot
invoke itself. LSP passes a `Command`'s `arguments` as **raw JSON**, while VS Code's built-in
`editor.action.showReferences` demands real `Uri` / `Position` / `Location` **instances**. The
conversion can only happen client-side.

So the server namespaces its own `otui.showSubtypes` with plain-JSON `[uri, position]`, and this
extension registers a handler that rebuilds the VS Code objects, re-runs
`textDocument/implementation` (which the server already answers with the inheriting styles), and
opens the peek view. This is the same two-repo pattern rust-analyzer uses. The command id and the
argument shape are the server's contract — they move together or not at all. A client that does not
register the command (Neovim, etc.) simply renders the lens title inertly, which is the intended
fallback.

## Reusing the server in another editor

Nothing about the analysis is VS Code-specific. To wire `otui-lsp` into another LSP client:

- Launch the `otui-lsp` binary and connect over **stdio**.
- Associate it with the `otui` language id (`.otui` / `.otmod` / `.otfont`), and optionally `lua`
  for the definition bridge.
- Feed it `workspace/didChangeWatchedFiles` for `.otui` (and `.lua`) so workspace-wide navigation
  resolves across closed files.

The two VS Code-specific adaptations above — the diagnostics middleware and the `otui.showSubtypes`
command — are conveniences, not requirements. Without them the server still works; a client just
renders the inheritance lens inertly and relies on the server's own language guard to stay off Lua.

## What belongs where

| Change | Repo |
|---|---|
| A diagnostic is wrong / missing | `otui-lsp` |
| Completion, hover, go-to-definition, rename behavior | `otui-lsp` |
| Semantic token classification | `otui-lsp` |
| TextMate coloring (pre-attach, or if the server fails) | here |
| Mapping a server token kind to a theme scope | here (`semanticTokenScopes`) |
| Adapting a server command into a VS Code action | here |
| Server binary resolution, activation, settings | here |
| Packaging, per-platform VSIX, publishing | here |
