---
name: Bug report
about: A problem with the extension itself — activation, install, the server not launching, coloring, settings
title: ""
labels: bug
assignees: ""
---

<!--
  Before filing: is this about how OTUI code is analyzed — a wrong or missing diagnostic,
  completion, hover, go-to-definition, rename, or a semantic-token color? That is the *server's*
  behavior, not this client's. Please file it at https://github.com/zoelner/otui-lsp/issues instead.

  This template is for the extension: it does not activate, does not install, the server fails to
  launch, coloring is off, a setting or command misbehaves.
-->

## What happened

<!-- A clear description of the bug and what you expected instead. -->

## Steps to reproduce

1.
2.
3.

## Environment

- **Editor and version:** <!-- e.g. VS Code 1.128.0 / Cursor / Windsurf / VSCodium -->
- **OS and CPU:** <!-- e.g. Windows 11 x64, macOS arm64, Linux x64, WSL2 -->
- **Extension version:**
- **Installed from:** <!-- Marketplace / Open VSX / a .vsix file -->

## Server output

<!--
  Run "OTUI: Show Language Server Output" and paste the relevant lines. The first lines name which
  binary was launched and where it came from (setting / bundled / PATH) — that is usually the key
  clue. For more detail, set "otui.trace.server": "verbose" and reproduce.
-->

```
paste server output here
```

## Anything else

<!-- Screenshots, a minimal sample folder, whether it happens with a custom otui.server.path, etc. -->
