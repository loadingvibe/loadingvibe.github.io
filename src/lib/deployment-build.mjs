import { execFileSync } from "node:child_process";

/** @param {unknown} value */
export function normalizeDeploymentTime(value) {
  if (typeof value !== "string") return null;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u);
  if (!parts) return null;
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (!daysInMonth || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Server/build-only: local previews reuse the last fetched release record.
 * CI provides one fixed timestamp for the artifact it is about to publish.
 * Neither an ordinary local build nor a page visit advances this timestamp.
 * @param {{ env?: Record<string, string | undefined>, cwd?: string }} [options]
 */
export function readDeploymentBuild({ env = process.env, cwd = process.cwd() } = {}) {
  if (env.SITE_DEPLOYMENT_BUILD_TIME !== undefined) {
    const builtAt = normalizeDeploymentTime(env.SITE_DEPLOYMENT_BUILD_TIME);
    if (!builtAt) throw new Error("SITE_DEPLOYMENT_BUILD_TIME must be an ISO timestamp with a timezone.");
    return { builtAt, source: "deployment-build" };
  }

  /** @param {string[]} args */
  const readGit = (args) => {
    try {
      return execFileSync("git", args, {
        cwd, encoding: "utf8", timeout: 2000, maxBuffer: 8192,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return "";
    }
  };

  // New releases publish this record alongside the HTML. Prefer the artifact's
  // timestamp over the slightly later commit that copied it to gh-pages.
  const releaseRecord = readGit(["show", "refs/remotes/origin/gh-pages:deployment-build.json"]);
  if (releaseRecord) {
    try {
      const builtAt = normalizeDeploymentTime(JSON.parse(releaseRecord).builtAt);
      if (builtAt) return { builtAt, source: "published-record" };
    } catch {
      // Older releases have no record; their deployment commit is the fallback.
    }
  }

  const builtAt = normalizeDeploymentTime(readGit([
    "log", "-1", "--format=%cI", "refs/remotes/origin/gh-pages",
  ]));
  return { builtAt, source: builtAt ? "deployment-commit" : "unrecorded" };
}

/** @param {string | null} builtAt */
export function formatDeploymentBuild(builtAt) {
  return builtAt ? new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    timeZone: "Asia/Shanghai",
  }).format(new Date(builtAt)) : "尚无部署记录";
}

export const deploymentBuild = readDeploymentBuild();
