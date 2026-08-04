import {
  cpSync,
  copyFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, "dist");
const publicDirectory = resolve(root, "public");

if (dirname(output) !== root) {
  throw new Error("Refusing to build outside the project root.");
}

rmSync(output, { recursive: true, force: true });
rmSync(publicDirectory, { recursive: true, force: true });
mkdirSync(publicDirectory, { recursive: true });

for (const filename of [
  "styles.css",
  "script.js",
  "editor.html",
  "editor.css",
  "editor.js",
]) {
  copyFileSync(
    resolve(root, filename),
    resolve(publicDirectory, filename),
  );
}

cpSync(resolve(root, "assets"), resolve(publicDirectory, "assets"), {
  recursive: true,
});

const vinextCli = resolve(root, "node_modules", "vinext", "dist", "cli.js");
const build = spawnSync(process.execPath, [vinextCli, "build"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

if (build.error) {
  throw build.error;
}

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const hostingOutput = resolve(output, ".openai");
mkdirSync(hostingOutput, { recursive: true });
copyFileSync(
  resolve(root, ".openai", "hosting.json"),
  resolve(hostingOutput, "hosting.json"),
);

process.stdout.write("Built Sites-compatible bundle in dist/\n");
