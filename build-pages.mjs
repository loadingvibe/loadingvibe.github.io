import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, "_site");
const customDomain = resolve(root, "public", "CNAME");
const destination = "https://loading-vibe-019f7844.fedorczykmarilynn269.chatgpt.site";
const redirectPage = resolve(root, "redirect.html");

if (dirname(output) !== root || relative(root, output) !== "_site") {
  throw new Error("Refusing to build outside the project root.");
}

if (!existsSync(redirectPage)) {
  throw new Error("Missing required file: redirect.html");
}

const redirectStats = lstatSync(redirectPage);
if (redirectStats.isSymbolicLink() || !redirectStats.isFile()) {
  throw new Error("redirect.html must be a regular file.");
}

if (!existsSync(customDomain)) {
  throw new Error("Missing required file: public/CNAME");
}

const customDomainStats = lstatSync(customDomain);
if (customDomainStats.isSymbolicLink() || !customDomainStats.isFile()) {
  throw new Error("public/CNAME must be a regular file.");
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

copyFileSync(redirectPage, resolve(output, "index.html"));
copyFileSync(customDomain, resolve(output, "CNAME"));
writeFileSync(resolve(output, ".nojekyll"), "", "utf8");

for (const filename of ["index.html", "CNAME", ".nojekyll"]) {
  const builtFile = resolve(output, filename);
  if (!existsSync(builtFile) || !statSync(builtFile).isFile()) {
    throw new Error(`Pages artifact is incomplete: ${filename}`);
  }
}

process.stdout.write(`Built GitHub Pages redirect to ${destination}\n`);
