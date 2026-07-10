// Tests for src/server.ts resolveServer(): the setting → bundled → PATH fallback chain
// that decides which binary the client launches.
//
// `vscode` is stubbed as a real module under a temp node_modules, NOT via an esbuild
// `alias` — an alias is inlined into the bundle, so the test would mutate a different
// copy of the stub than the bundle reads, and every assertion would pass vacuously.
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { test, before, after } from "node:test";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const REPO = path.join(import.meta.dirname, "..");

let sandbox;
let vscode;
let resolveServer;
let ServerNotFoundError;

const STUB = `let setting = null;
module.exports = {
  __setSetting: (v) => { setting = v; },
  workspace: {
    getConfiguration: () => ({ get: () => setting }),
    workspaceFolders: [{ uri: { fsPath: "/tmp/ws" } }],
  },
};`;

before(async () => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "otui-server-test-"));

  const stubDir = path.join(sandbox, "node_modules", "vscode");
  fs.mkdirSync(stubDir, { recursive: true });
  fs.writeFileSync(path.join(stubDir, "package.json"), '{"name":"vscode","main":"index.js"}');
  fs.writeFileSync(path.join(stubDir, "index.js"), STUB);

  const bundle = path.join(sandbox, "server.cjs");
  await esbuild.build({
    entryPoints: [path.join(REPO, "src", "server.ts")],
    bundle: true,
    outfile: bundle,
    format: "cjs",
    platform: "node",
    external: ["vscode"],
    logLevel: "warning",
  });

  vscode = require(path.join(stubDir, "index.js"));
  ({ resolveServer, ServerNotFoundError } = require(bundle));
  assert.equal(typeof vscode.__setSetting, "function", "stub must be the module the bundle sees");
});

after(() => fs.rmSync(sandbox, { recursive: true, force: true }));

/** A fake ExtensionContext rooted at `root`. */
const contextAt = (root) => ({ asAbsolutePath: (p) => path.join(root, p) });

/** Create an executable stub binary at `file`, with the given mode. */
function writeBinary(file, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "#!/bin/sh\n");
  fs.chmodSync(file, mode);
  return file;
}

/** Run `fn` with PATH set to `dir` only. */
function withPath(dir, fn) {
  const saved = process.env.PATH;
  process.env.PATH = dir;
  try {
    return fn();
  } finally {
    process.env.PATH = saved;
  }
}

test("a bundled binary is found and made executable", { skip: process.platform === "win32" }, () => {
  const root = path.join(sandbox, "case-bundled");
  // CI's upload-artifact drops permissions, so the shipped binary can arrive as 0644.
  const bin = writeBinary(path.join(root, "server", "otui-lsp"), 0o644);

  vscode.__setSetting(null);
  const resolved = resolveServer(contextAt(root));

  assert.equal(resolved.origin, "bundled");
  assert.equal(resolved.command, bin);
  assert.ok(fs.statSync(bin).mode & 0o111, "the bundled binary must be chmod +x'd");
});

test("with no bundled binary, it falls back to PATH", { skip: process.platform === "win32" }, () => {
  const root = path.join(sandbox, "case-path");
  fs.mkdirSync(root, { recursive: true });
  const bin = writeBinary(path.join(sandbox, "bin", "otui-lsp"), 0o755);

  vscode.__setSetting(null);
  const resolved = withPath(path.dirname(bin), () => resolveServer(contextAt(root)));

  assert.equal(resolved.origin, "path");
  assert.equal(resolved.command, bin);
});

test("with no binary anywhere, it reports where it looked", () => {
  const root = path.join(sandbox, "case-missing");
  fs.mkdirSync(root, { recursive: true });

  vscode.__setSetting(null);
  const error = withPath(path.join(sandbox, "nowhere"), () => {
    try {
      resolveServer(contextAt(root));
    } catch (e) {
      return e;
    }
    return undefined;
  });

  assert.ok(error instanceof ServerNotFoundError);
  assert.ok(error.searched.length > 0, "the error must list the paths tried");
});

test("a bad otui.server.path errors rather than silently using another binary", () => {
  // A bundled binary exists here — an explicit override must still win, and fail loudly.
  const root = path.join(sandbox, "case-bundled");
  vscode.__setSetting(path.join(sandbox, "definitely", "not", "here"));

  assert.throws(() => resolveServer(contextAt(root)), ServerNotFoundError);
});

test("`~` in otui.server.path is expanded", { skip: process.platform === "win32" }, () => {
  const name = ".otui-server-test-bin";
  const bin = writeBinary(path.join(os.homedir(), name), 0o755);
  try {
    vscode.__setSetting(`~/${name}`);
    const resolved = resolveServer(contextAt(path.join(sandbox, "case-missing")));
    assert.equal(resolved.origin, "setting");
    assert.equal(resolved.command, bin);
  } finally {
    fs.rmSync(bin, { force: true });
  }
});
