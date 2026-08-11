import {
  cpSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, "_site");
const requiredFiles = [
  "index.html",
  "editor.html",
  "styles.css",
  "script.js",
  "editor.css",
  "editor.js",
];
const requiredDirectories = ["assets"];

function assertNoSymbolicLinks(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(
        `GitHub Pages artifacts cannot contain symbolic links: ${relative(root, entryPath)}`,
      );
    }

    if (entry.isDirectory()) {
      assertNoSymbolicLinks(entryPath);
    }
  }
}

if (dirname(output) !== root || relative(root, output) !== "_site") {
  throw new Error("Refusing to build outside the project root.");
}

for (const filename of requiredFiles) {
  const source = resolve(root, filename);
  if (!existsSync(source)) {
    throw new Error(`Missing required file: ${filename}`);
  }

  const sourceStats = lstatSync(source);
  if (sourceStats.isSymbolicLink() || !sourceStats.isFile()) {
    throw new Error(`Required file must be a regular file: ${filename}`);
  }
}

for (const directory of requiredDirectories) {
  const source = resolve(root, directory);
  if (!existsSync(source)) {
    throw new Error(`Missing required directory: ${directory}`);
  }

  const sourceStats = lstatSync(source);
  if (sourceStats.isSymbolicLink() || !sourceStats.isDirectory()) {
    throw new Error(`Required directory must be a regular directory: ${directory}`);
  }
  assertNoSymbolicLinks(source);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const filename of requiredFiles) {
  copyFileSync(resolve(root, filename), resolve(output, filename));
}

for (const directory of requiredDirectories) {
  cpSync(resolve(root, directory), resolve(output, directory), {
    recursive: true,
  });
}

writeFileSync(resolve(output, ".nojekyll"), "", "utf8");

for (const filename of [...requiredFiles, ".nojekyll"]) {
  const builtFile = resolve(output, filename);
  if (!existsSync(builtFile) || !statSync(builtFile).isFile()) {
    throw new Error(`Pages artifact is incomplete: ${filename}`);
  }
}

const builtAssets = resolve(output, "assets");
if (!existsSync(builtAssets) || !statSync(builtAssets).isDirectory()) {
  throw new Error("Pages artifact is incomplete: assets");
}

process.stdout.write("Built GitHub Pages artifact in _site/\n");
