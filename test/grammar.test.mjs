// Regression tests for syntaxes/otui.tmLanguage.json, run against the same TextMate
// engine VS Code uses. They pin the OTML rules that a naive grammar gets wrong.
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import { test, before } from "node:test";

const require = createRequire(import.meta.url);
const vsctm = require("vscode-textmate");
const oniguruma = require("vscode-oniguruma");

const GRAMMAR = path.join(import.meta.dirname, "..", "syntaxes", "otui.tmLanguage.json");

/** Minimal stand-in for VS Code's built-in Lua grammar, so `include: source.lua` resolves. */
const LUA_STUB = {
  scopeName: "source.lua",
  patterns: [{ match: "\\b(?:function|end|return|local|not|nil)\\b", name: "keyword.lua" }],
};

let grammar;

before(async () => {
  const wasm = fs.readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm"));
  const onigLib = oniguruma.loadWASM(wasm.buffer).then(() => ({
    createOnigScanner: (s) => new oniguruma.OnigScanner(s),
    createOnigString: (s) => new oniguruma.OnigString(s),
  }));

  const registry = new vsctm.Registry({
    onigLib,
    loadGrammar: async (scope) => {
      if (scope === "source.otui") {
        return vsctm.parseRawGrammar(fs.readFileSync(GRAMMAR, "utf8"), GRAMMAR);
      }
      return scope === "source.lua" ? LUA_STUB : null;
    },
  });

  grammar = await registry.loadGrammar("source.otui");
  assert.ok(grammar, "source.otui grammar failed to load");
});

/** Tokenize `source` and return `[text, scopes[]]` pairs for the given 0-based line. */
function tokensOf(source, line = 0) {
  const lines = source.split("\n");
  let ruleStack = vsctm.INITIAL;
  let result;
  for (let i = 0; i <= line; i++) {
    result = grammar.tokenizeLine(lines[i], ruleStack);
    ruleStack = result.ruleStack;
  }
  return result.tokens.map((t) => [lines[line].substring(t.startIndex, t.endIndex), t.scopes]);
}

/** The scopes applied to the first token whose text is exactly `text`. */
function scopesFor(source, text, line = 0) {
  const hit = tokensOf(source, line).find(([t]) => t === text);
  assert.ok(hit, `no token exactly "${text}" on line ${line}`);
  return hit[1];
}

const hasScope = (scopes, prefix) => scopes.some((s) => s.startsWith(prefix));

test("`//` and `#` are comments only at the start of a line", () => {
  assert.ok(hasScope(scopesFor("// hello", "// hello"), "comment.line"));
  assert.ok(hasScope(scopesFor("# hello", "# hello"), "comment.line"));
});

test("a trailing `//` after real tokens is data, not a comment", () => {
  const scopes = scopesFor("  width: 10 // not a comment", "//");
  assert.ok(!hasScope(scopes, "comment"), `expected data, got ${scopes.join(" ")}`);
  assert.ok(hasScope(scopes, "string.unquoted"));
});

test("a trailing `#` after real tokens is data, not a comment", () => {
  const scopes = scopesFor("  height: 20 # not a comment", "#");
  assert.ok(!hasScope(scopes, "comment"));
});

test("a `#` in a style header's base is part of the base", () => {
  const line = "Name < UIWidget # data";
  assert.ok(hasScope(scopesFor(line, "UIWidget"), "support.class.widget"));
  // The trailing `# data` belongs to the base — it is never a comment.
  assert.ok(tokensOf(line).every(([, scopes]) => !hasScope(scopes, "comment")));
});

test("a base starting with `UI` is a built-in widget, but `MyUIThing` is not", () => {
  assert.ok(hasScope(scopesFor("A < UIButton", "UIButton"), "support.class.widget"));
  assert.ok(hasScope(scopesFor("A < MyUIThing", "MyUIThing"), "entity.other.inherited-class"));
});

test("a non-`UI` base is a file-defined style, not a built-in widget", () => {
  const scopes = scopesFor("Name < MyPanel", "MyPanel");
  assert.ok(hasScope(scopes, "entity.other.inherited-class"));
  assert.ok(!hasScope(scopes, "support.class.widget"));
});

test("colors beat numbers", () => {
  assert.ok(hasScope(scopesFor("  color: #ff0000", "#ff0000"), "constant.other.color"));
});

test("an `&tag:` value starting with `#` is a literal, never Lua (§2.6 carve-out)", () => {
  const scopes = scopesFor("  &myColor: #00ff00", "#00ff00");
  assert.ok(hasScope(scopes, "constant.other.color"));
  assert.ok(!hasScope(scopes, "meta.embedded"), "must not be Lua-injected");
});

test("`@tag:` / `!tag:` / `&tag:` bodies are Lua-injected", () => {
  for (const line of ['  @onClick: print("hi")', "  !enabled: not x", "  &helper: function() end"]) {
    const embedded = tokensOf(line).some(([, scopes]) => hasScope(scopes, "meta.embedded"));
    assert.ok(embedded, `expected embedded Lua in: ${line}`);
  }
});

test("a `@tag: |` block scalar keeps its body Lua-injected across lines", () => {
  const source = "  @onSetup: |\n    local x = 1\n  width: 10";
  assert.ok(hasScope(scopesFor(source, "local", 1), "meta.embedded.block.lua"));
  // The block must close when indentation returns to the key's level.
  assert.ok(hasScope(scopesFor(source, "width", 2), "support.type.property-name"));
});

test("a plain `key: |` block scalar is literal text, not Lua", () => {
  const source = "  text: |\n    hello\n";
  const scopes = scopesFor(source, "hello", 1);
  assert.ok(hasScope(scopes, "string.unquoted.block"));
  assert.ok(!hasScope(scopes, "meta.embedded"));
});

test("known state names are distinct from unknown ones", () => {
  assert.ok(hasScope(scopesFor("  $hover !disabled:", "hover"), "constant.language.state"));
  assert.ok(hasScope(scopesFor("  $hover !disabled:", "disabled"), "constant.language.state"));
  assert.ok(hasScope(scopesFor("  $hover !disabled:", "!"), "keyword.operator.negation"));
  // An unknown state silently never matches at runtime — render it visibly differently.
  assert.ok(hasScope(scopesFor("  $bogus:", "bogus"), "variable.parameter.state"));
});

test("`id:` is a definition target, not a generic property", () => {
  assert.ok(hasScope(scopesFor("  id: mainWindow", "id"), "keyword.other.id"));
  assert.ok(hasScope(scopesFor("  id: mainWindow", "mainWindow"), "entity.name.label"));
});

test("`anchors.<edge>:` is an anchor; a generic dotted key is not", () => {
  assert.ok(hasScope(scopesFor("  anchors.top: parent.top", "anchors"), "support.type.anchor"));
  assert.ok(
    hasScope(scopesFor("  anchors.top: parent.top", "parent.top"), "variable.other.anchor-target"),
  );
});

test("a comma inside an untyped scalar is data, not an array separator", () => {
  const scopes = scopesFor("  text: a, b", "a,");
  assert.ok(hasScope(scopes, "string.unquoted"));
  assert.ok(!hasScope(scopes, "punctuation.separator.array"));
});

test("an inline array separates its items", () => {
  assert.ok(hasScope(scopesFor("  padding: [1, 2]", ","), "punctuation.separator.array"));
  assert.ok(hasScope(scopesFor("  padding: [1, 2]", "1"), "constant.numeric"));
});

test("a bare tag line is a container", () => {
  assert.ok(hasScope(scopesFor("  Panel", "Panel"), "entity.name.tag"));
});
