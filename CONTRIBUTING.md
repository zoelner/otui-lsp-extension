# Contributing

Thanks for helping out. This document is the day-to-day guide for working on the extension.

## Before you start: which repo?

This is a **thin language client**. All language intelligence — diagnostics, completion, hover,
go-to-definition, rename, semantic tokens — lives in the server,
[`otui-lsp`](https://github.com/zoelner/otui-lsp). If your change would compute something *about*
OTUI code, it almost certainly belongs there, not here. See [ARCHITECTURE](docs/ARCHITECTURE.md)
for the full split and a table of what goes where.

Good changes for **this** repo: the TextMate grammar, semantic-token-to-scope mapping, server
resolution and launch, settings, activation, packaging, and adapting a server command into a VS Code
action.

## Prerequisites

- The current Node LTS — the version is pinned in [`.nvmrc`](.nvmrc). With `nvm`: `nvm use`.
- An `otui-lsp` server binary to run against (see [Getting a server](#getting-a-server)).

## Setup

```bash
npm install
```

## The dev loop

Press **F5** in VS Code to launch an **Extension Development Host** — a second window with the
extension loaded and the `sample/` folder open. It builds first (`preLaunchTask`) and reloads the
`dist/` output. This is the fastest way to see a change live.

For a tighter loop, run the bundler in watch mode in a terminal and reload the host window
(`Developer: Reload Window`) after each change:

```bash
npm run watch
```

### Getting a server

The Extension Development Host needs a server to talk to. Any of these works, in the resolution
order the extension uses:

1. Set `"otui.server.path"` in the host's settings to a binary you built:
   ```bash
   # in the otui-lsp repo
   cargo install --path crates/otui-lsp-server   # → ~/.cargo/bin/otui-lsp
   ```
2. Put `otui-lsp` on your `PATH`.
3. Drop a binary at `server/otui-lsp` in this repo (this is what the packaged VSIX bundles).

A path set in `otui.server.path` that does not exist is a **hard error**, by design — it never
silently falls back to another binary.

## Checks

Run all three before opening a PR:

```bash
npm run check     # tsc --noEmit — typecheck against the supported API floor
npm test          # grammar tests + server-resolution tests
npm run build     # esbuild → dist/
```

- **`npm run check`** is the guard for the deliberate version pins (see below). It typechecks
  against the *oldest* supported editor's API surface, so a call to an API that VS Code 1.91 lacks
  fails here.
- **`npm test`** runs two suites with Node's built-in test runner: the grammar suite tokenizes
  fixtures with VS Code's own TextMate engine and asserts the OTML rules, and the server suite
  asserts the binary-resolution fallback chain.

## Deliberate version pins — do not "fix" these

Three dependencies are held at a floor on purpose, because they describe the **oldest** editor we
support, and the VS Code-compatible forks lag upstream:

- **`engines.vscode` (`^1.91.0`)** — the oldest editor that can install the extension. It is the
  floor of `vscode-languageclient` v10, not a stale value. Raising it locks out the forks.
- **`@types/vscode` (pinned exactly `1.91.0`, no caret)** — a caret resolves to the newest types and
  would happily typecheck against APIs the floor does not have. `npm run check` enforces this.
- **esbuild `target: node20`** — the extension host's Node (VS Code 1.91 ships Node 20), not the
  Node you build with.

If you think one of these needs to change, say so in the PR and explain why — they have bitten
before.

## Commits and pull requests

- Write **imperative, present-tense** commit subjects (`Add …`, `Fix …`, not `Added`/`Fixes`).
- Explain the **why** in the body when it is not obvious — that is what future readers need.
- Keep commit messages **plain**: no AI-assistant trailers or co-author lines.
- Run the three checks above and, for anything with runtime behavior, exercise it in the Extension
  Development Host before pushing.

Open a PR against `main`. The [pull request template](.github/pull_request_template.md) has a short
checklist; the [issue templates](.github/ISSUE_TEMPLATE) will route language-behavior reports to the
server repo where they belong.

## Releasing

Releases are cut by tag and handled by CI; the full process is documented in the
[README](README.md#releasing). In short: `otuiLsp.ref` in `package.json` pins the server revision to
build, and pushing a `v*` tag builds one VSIX per platform and publishes to both registries.

## License

By contributing, you agree that your contributions are dual-licensed under
[MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at the user's option — matching the rest of the
project.
