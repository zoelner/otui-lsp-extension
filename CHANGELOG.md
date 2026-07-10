# Changelog

## 0.1.0

First release aimed at VS Code **and** the VS Code–compatible editors (Cursor, Antigravity,
Windsurf, VSCodium).

### Added

- Platform-specific packages that bundle the `otui-lsp` server binary — no Rust toolchain, no
  `PATH` setup. Built and published for `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`,
  `win32-x64` and `win32-arm64`.
- Publishing to **Open VSX** alongside the Visual Studio Marketplace, which is how the forks
  resolve extensions.
- A TextMate grammar, so files are colored before the language server attaches, and still colored
  if the server fails to start. Embedded Lua in `@event:` / `!expr:` / `&alias:` values is
  delegated to the editor's Lua grammar.
- Commands **OTUI: Restart Language Server** and **OTUI: Show Language Server Output**.
- `extensionKind: ["workspace"]`, so the extension runs next to the files over Remote SSH, WSL and
  dev containers rather than on the UI side.
- Declared `untrustedWorkspaces` and `virtualWorkspaces` capabilities.
- Regression tests for the grammar (run against VS Code's own TextMate engine) and for the server
  binary resolution chain.

### Changed

- The client is now TypeScript, bundled with esbuild.
- `otui.server.path` now defaults to unset and resolves setting → bundled → `PATH`. It is scoped
  `machine-overridable`, so a workspace cannot silently redirect which binary gets executed. A
  path that is set but missing is now a hard error instead of a silent fallback.
- Indentation and folding rules reflect OTML's off-side (indentation-based) block structure.

### Fixed

- `otui.trace.server` had no effect. `vscode-languageclient` reads its trace level from
  `<client id>.trace.server`, and the client id was `otui-lsp`, not `otui`.
- `sample/example.otui` used `$hover` without a trailing `:`, which is a container tag rather than
  the state selector it was meant to be.
