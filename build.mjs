import {
  cpSync,
  copyFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, "dist");

if (dirname(output) !== root) {
  throw new Error("Refusing to build outside the project root.");
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const filename of ["index.html", "styles.css", "script.js"]) {
  copyFileSync(resolve(root, filename), resolve(output, filename));
}

cpSync(resolve(root, "assets"), resolve(output, "assets"), {
  recursive: true,
});

process.stdout.write("Built static site in dist/\n");
