import * as vscode from "vscode";
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";

import { ServerNotFoundError, resolveServer } from "./server";

// The client id must be `otui` — `vscode-languageclient` reads its trace level from
// `<id>.trace.server`, so any other id silently disables `otui.trace.server`.
const CLIENT_ID = "otui";
const CLIENT_NAME = "OTUI Language Server";

// Documents the server understands. `.otmod` / `.otfont` share the `otui` language id.
const OTUI_WATCH = "**/*.{otui,otmod,otfont}";
// Lua files carry the other half of a module — the server resolves `getChildById('x')` in a `.lua`
// to the `id: x` in its sibling `.otui`. Watched only when the Lua bridge is enabled.
const LUA_WATCH = "**/*.lua";

/** Whether to attach the server to `.lua` files for the `.lua` → `.otui` go-to-definition bridge. */
function luaBridgeEnabled(): boolean {
  return vscode.workspace.getConfiguration("otui").get<boolean>("lua.enable", true);
}

let client: LanguageClient | undefined;
let output: vscode.LogOutputChannel;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  output = vscode.window.createOutputChannel(CLIENT_NAME, { log: true });
  context.subscriptions.push(output);

  context.subscriptions.push(
    vscode.commands.registerCommand("otui.showServerLog", () => output.show()),
    vscode.commands.registerCommand("otui.restartServer", () => restart(context)),
  );

  // The server path and the Lua bridge are both baked into the client at construction (the binary
  // to spawn, and the document selector), so changing either means the running client is stale.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (
        event.affectsConfiguration("otui.server.path") ||
        event.affectsConfiguration("otui.lua.enable")
      ) {
        output.info("OTUI configuration changed — restarting the server.");
        await restart(context);
      }
    }),
  );

  await start(context);
}

export async function deactivate(): Promise<void> {
  await stop();
}

async function start(context: vscode.ExtensionContext): Promise<void> {
  let server;
  try {
    server = resolveServer(context);
  } catch (error) {
    await reportMissingServer(error);
    return;
  }

  output.info(`Using otui-lsp from ${server.origin}: ${server.command}`);

  const run = { command: server.command, transport: TransportKind.stdio };
  const serverOptions: ServerOptions = { run, debug: run };

  const luaEnabled = luaBridgeEnabled();
  output.info(`Lua bridge (.lua → .otui go-to-definition): ${luaEnabled ? "on" : "off"}`);

  const documentSelector = [{ scheme: "file", language: "otui" }];
  const watchers = [vscode.workspace.createFileSystemWatcher(OTUI_WATCH)];
  if (luaEnabled) {
    documentSelector.push({ scheme: "file", language: "lua" });
    watchers.push(vscode.workspace.createFileSystemWatcher(LUA_WATCH));
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector,
    outputChannel: output,
    synchronize: {
      // Feeds the server `workspace/didChangeWatchedFiles` so it re-indexes files that
      // change on disk while closed — this is what makes workspace-wide references,
      // rename and type hierarchy resolve against files no editor has open.
      fileEvents: watchers,
    },
    middleware: {
      // The server serves only go-to-definition on `.lua` — never diagnostics. Enforce that
      // client-side so a server without the language guard cannot spray OTUI parse errors over
      // valid Lua. This filters only *our* server's diagnostics; the Lua language server publishes
      // through its own client and is untouched.
      handleDiagnostics(uri, diagnostics, next) {
        next(uri, uri.path.endsWith(".lua") ? [] : diagnostics);
      },
    },
  };

  client = new LanguageClient(CLIENT_ID, CLIENT_NAME, serverOptions, clientOptions);

  try {
    await client.start();
  } catch (error) {
    client = undefined;
    const message = error instanceof Error ? error.message : String(error);
    output.error(`Failed to start otui-lsp: ${message}`);
    const choice = await vscode.window.showErrorMessage(
      `The otui-lsp server failed to start (${server.command}).`,
      "Show Log",
    );
    if (choice === "Show Log") {
      output.show();
    }
  }
}

async function stop(): Promise<void> {
  const current = client;
  client = undefined;
  await current?.stop().catch(() => current?.dispose());
}

async function restart(context: vscode.ExtensionContext): Promise<void> {
  await stop();
  await start(context);
}

async function reportMissingServer(error: unknown): Promise<void> {
  if (!(error instanceof ServerNotFoundError)) {
    throw error;
  }

  output.error(`${error.message} Looked in:\n  ${error.searched.join("\n  ")}`);

  const openSettings = "Open Settings";
  const install = "Installation Help";
  const choice = await vscode.window.showErrorMessage(
    "Could not find the otui-lsp language server. Install it, or set `otui.server.path` to a binary.",
    openSettings,
    install,
  );

  if (choice === openSettings) {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "otui.server.path",
    );
  } else if (choice === install) {
    await vscode.env.openExternal(
      vscode.Uri.parse("https://github.com/zoelner/otui-lsp#installation"),
    );
  }
}
