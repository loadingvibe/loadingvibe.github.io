import { execFileSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { relative } from "node:path";

// A preview save must not repeatedly walk Git history. New commits invalidate the cache.
const historyCache = new Map();

function git(directory, args) {
  return execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 * 1024 * 1024,
  });
}

function creationHistory(directory) {
  try {
    const [root, head] = git(directory, ["rev-parse", "--show-toplevel", "HEAD"]).trim().split("\n");
    const cached = historyCache.get(root);
    if (cached?.head === head) return cached;
    const dates = new Map();
    const tokens = git(root, ["log", "--reverse", "--topo-order", "--format=%x00%aI%x00", "--name-status", "-z", "--find-renames", "--diff-filter=ADR"]).split("\0");
    let committedAt;
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index].trim();
      if (!token) continue;
      if (/^\d{4}-\d{2}-\d{2}T/u.test(token)) {
        committedAt = new Date(token);
      } else if (token === "A") {
        const path = tokens[++index];
        if (committedAt && Number.isFinite(committedAt.getTime())) dates.set(path, committedAt);
      } else if (token === "D") {
        dates.delete(tokens[++index]);
      } else if (/^R\d+$/u.test(token)) {
        const previous = tokens[++index];
        const current = tokens[++index];
        const createdAt = dates.get(previous) || committedAt;
        dates.delete(previous);
        if (createdAt && Number.isFinite(createdAt.getTime())) dates.set(current, createdAt);
      }
    }
    const history = { root, head, dates };
    historyCache.set(root, history);
    return history;
  } catch {
    // A plain folder, a repository without commits, or a Git-free build can use birthtime.
    return undefined;
  }
}

/** Resolve creation once per source batch; neither saves nor checkout mtime affect it. */
export function createBlogCreationReader(blogRoot) {
  let loaded = false;
  let history;
  return (filePath) => {
    if (!loaded) {
      history = creationHistory(blogRoot);
      loaded = true;
    }
    if (history) {
      try {
        const path = relative(history.root, realpathSync(filePath)).replaceAll("\\", "/");
        const committedAt = history.dates.get(path);
        if (committedAt) return new Date(committedAt);
      } catch { /* A watcher can observe a file just after deletion. */ }
    }
    try {
      const { birthtime } = statSync(filePath);
      return Number.isFinite(birthtime.getTime()) && birthtime.getTime() > 0 ? birthtime : undefined;
    } catch {
      return undefined;
    }
  };
}
