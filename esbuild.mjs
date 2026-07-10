import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  // The extension host is Node, loads CommonJS, and provides `vscode` itself.
  format: "cjs",
  platform: "node",
  // The floor is the extension host's Node, not the Node we build with: VS Code
  // 1.91 (our `engines.vscode`) ships Electron 29 / Node 20.
  target: "node20",
  external: ["vscode"],
  minify: production,
  sourcemap: !production,
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
