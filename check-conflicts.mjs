import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const extensions = /\.(?:c?js|mjs|jsx|ts|tsx|json|ya?ml|css|md|html|sql)$/i;
const markers = ["<".repeat(7), "=".repeat(7), ">".repeat(7)];
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((file) => file && extensions.test(file));

const conflicts = [];
for (const file of files) {
  if (!existsSync(file)) continue;
  const source = readFileSync(file, "utf8");
  source.split(/\r?\n/).forEach((line, index) => {
    if (markers.some((marker) => line.startsWith(marker))) {
      conflicts.push(`${file}:${index + 1}: ${line}`);
    }
  });
}

if (conflicts.length) {
  console.error("Unresolved merge markers found:\n" + conflicts.join("\n"));
  process.exitCode = 1;
} else {
  console.log("No unresolved merge markers found.");
}
