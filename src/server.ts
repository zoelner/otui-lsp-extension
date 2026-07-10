import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

/** Where a resolved server binary came from — surfaced in the output channel. */
export type ServerOrigin = "setting" | "bundled" | "path";

export interface ResolvedServer {
  command: string;
  origin: ServerOrigin;
}

/** No binary could be found. Carries the places we looked so we can tell the user. */
export class ServerNotFoundError extends Error {
  constructor(readonly searched: string[]) {
    super("Could not find an otui-lsp server binary.");
    this.name = "ServerNotFoundError";
  }
}

const BINARY = process.platform === "win32" ? "otui-lsp.exe" : "otui-lsp";

/**
 * Resolve the server binary, in priority order:
 *
 *   1. `otui.server.path` — an explicit override, always wins.
 *   2. `server/<BINARY>` inside the extension — present in the platform-specific VSIX.
 *   3. `otui-lsp` on `PATH` — the `cargo install` / package-manager case.
 */
export function resolveServer(context: vscode.ExtensionContext): ResolvedServer {
  const searched: string[] = [];

  const configured = vscode.workspace
    .getConfiguration("otui")
    .get<string | null>("server.path");
  if (configured && configured.trim().length > 0) {
    const expanded = expand(configured.trim());
    // An explicit override that does not exist is a misconfiguration, not a cue to
    // silently fall through to some other binary the user did not ask for.
    if (!isExecutableFile(expanded)) {
      throw new ServerNotFoundError([`otui.server.path → ${expanded}`]);
    }
    return { command: expanded, origin: "setting" };
  }

  const bundled = context.asAbsolutePath(path.join("server", BINARY));
  searched.push(bundled);
  if (fs.existsSync(bundled)) {
    // A VSIX is a zip, and zips carry no POSIX permission bits that the extension
    // host restores — the unpacked binary comes out non-executable on Unix.
    ensureExecutable(bundled);
    return { command: bundled, origin: "bundled" };
  }

  const onPath = findOnPath(BINARY);
  searched.push(`${BINARY} on PATH`);
  if (onPath) {
    return { command: onPath, origin: "path" };
  }

  throw new ServerNotFoundError(searched);
}

/** Expand `~` and `${workspaceFolder}` in a user-supplied path. */
function expand(input: string): string {
  let result = input;

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder) {
    result = result.replace(/\$\{workspaceFolder\}/g, folder.uri.fsPath);
  }
  if (result === "~") {
    result = os.homedir();
  } else if (result.startsWith("~/") || result.startsWith("~\\")) {
    result = path.join(os.homedir(), result.slice(2));
  }
  return path.normalize(result);
}

function isExecutableFile(candidate: string): boolean {
  try {
    if (!fs.statSync(candidate).isFile()) {
      return false;
    }
  } catch {
    return false;
  }
  if (process.platform === "win32") {
    return true;
  }
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function ensureExecutable(binary: string): void {
  if (process.platform === "win32") {
    return;
  }
  try {
    const mode = fs.statSync(binary).mode;
    // Mirror read bits into execute bits, leaving the rest of the mode alone.
    fs.chmodSync(binary, mode | 0o111);
  } catch {
    // Best effort: if we cannot chmod, spawning will fail with a clearer error.
  }
}

/** A minimal, dependency-free `which`, honouring PATHEXT on Windows. */
function findOnPath(binary: string): string | undefined {
  const entries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE").split(";").filter(Boolean)
      : [""];

  for (const dir of entries) {
    for (const ext of extensions) {
      // On Windows `binary` already ends in `.exe`; only append a *different* ext.
      const name = binary.toLowerCase().endsWith(ext.toLowerCase())
        ? binary
        : binary + ext;
      const candidate = path.join(dir, name);
      if (isExecutableFile(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}
