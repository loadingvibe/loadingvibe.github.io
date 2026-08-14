import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

function read(relativePath) {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

function parseJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = parseJson("package.json");
const vercel = parseJson("vercel.json");
const wrangler = parseJson("wrangler.jsonc");
const sourceIndex = read("index.html");
const builtIndex = read("_site/index.html");

assert(packageJson.scripts?.["build:static"], "package.json is missing build:static");
assert(vercel.framework === null, "Vercel must use the Other framework preset");
assert(vercel.buildCommand === "npm run build:static", "Vercel must run the shared static build");
assert(vercel.outputDirectory === "_site", "Vercel must publish _site");
assert(wrangler.assets?.directory === "./_site", "Cloudflare Workers must publish _site");
assert(
  wrangler.assets?.not_found_handling === "single-page-application",
  "Cloudflare Workers must enable the SPA fallback",
);

for (const [name, html] of [["source", sourceIndex], ["built", builtIndex]]) {
  assert(html.includes("有点来电｜Roy 的生活与笔记"), `${name} index is not the current website`);
  assert(!html.includes("值得听的，正在来电"), `${name} index still contains the archived website`);
}

process.stdout.write("Deployment configuration passed for GitHub Pages, Vercel, and Cloudflare Workers.\n");
