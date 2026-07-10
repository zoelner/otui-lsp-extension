// @ts-check
"use strict";

// A thin VS Code client for the `otui-lsp` language server. It spawns the server binary and speaks
// LSP over stdio; ALL language intelligence lives in the server (otui-lsp), not here.

const { workspace, window } = require("vscode");
const {
  LanguageClient,
  TransportKind,
} = require("vscode-languageclient/node");

/** @type {import('vscode-languageclient/node').LanguageClient | undefined} */
let client;

/** @param {import('vscode').ExtensionContext} context */
function activate(context) {
  const config = workspace.getConfiguration("otui");
  const command = config.get("server.path", "otui-lsp");

  // The server is a plain stdio binary; run the same executable for both normal and debug runs.
  /** @type {import('vscode-languageclient/node').ServerOptions} */
  const serverOptions = {
    run: { command, transport: TransportKind.stdio },
    debug: { command, transport: TransportKind.stdio },
  };

  /** @type {import('vscode-languageclient/node').LanguageClientOptions} */
  const clientOptions = {
    // Attach to on-disk OTUI documents (the server resolves workspace-wide references against files).
    documentSelector: [{ scheme: "file", language: "otui" }],
    synchronize: {
      // Feed the server `workspace/didChangeWatchedFiles` so it re-indexes closed .otui files as they
      // change on disk — this is what makes references/rename/typeHierarchy work workspace-wide.
      fileEvents: workspace.createFileSystemWatcher("**/*.otui"),
    },
  };

  client = new LanguageClient(
    "otui-lsp",
    "OTUI Language Server",
    serverOptions,
    clientOptions
  );

  client.start().catch((err) => {
    window.showErrorMessage(
      `otui-lsp failed to start (command: "${command}"). ` +
        `Set "otui.server.path" to your built binary (target/release/otui-lsp). Details: ${err}`
    );
  });
}

function deactivate() {
  return client ? client.stop() : undefined;
}

module.exports = { activate, deactivate };
