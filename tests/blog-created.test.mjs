import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createBlogCreationReader } from "../src/lib/blog-created.mjs";
import { readBlogSources } from "../src/lib/blog-content.mjs";

function git(root, args, date) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_AUTHOR_NAME: "Blog test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Blog test", GIT_COMMITTER_EMAIL: "test@example.com", ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) },
  });
}

test("plain notes use birthtime and saves cannot replace it with modification time", () => {
  const root = mkdtempSync(join(tmpdir(), "blog-birthtime-"));
  try {
    const source = join(root, "plain.md");
    writeFileSync(source, "# Plain note");
    const expected = statSync(source).birthtime.toISOString();
    utimesSync(source, new Date("2099-01-01"), new Date("2099-01-01"));
    const [before] = readBlogSources(root);
    assert.equal(before.data.createdAt.toISOString(), expected);
    assert.equal(before.data.date.toISOString(), expected);
    writeFileSync(source, "# Plain note\n\nEdited body");
    const [after] = readBlogSources(root);
    assert.equal(after.data.createdAt.toISOString(), expected);
    assert.ok(after.body.includes("Edited body"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Git first-add dates survive edits and renames and new commits refresh the cache", () => {
  const root = mkdtempSync(join(tmpdir(), "blog-git-created-"));
  try {
    git(root, ["init", "--quiet"]);
    const blogRoot = join(root, "Blog");
    mkdirSync(join(blogRoot, "知识库"), { recursive: true });
    const original = join(blogRoot, "知识库", "original.md");
    writeFileSync(original, "# Original\n\nThe original note body.");
    git(root, ["add", "."]);
    git(root, ["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Create note"], "2026-01-02T03:04:05Z");
    assert.equal(readBlogSources(blogRoot)[0].data.createdAt.toISOString(), "2026-01-02T03:04:05.000Z");
    writeFileSync(original, "# Original\n\nThe original note body.\n\nAn added paragraph.");
    utimesSync(original, new Date("2099-01-01"), new Date("2099-01-01"));
    git(root, ["add", "."]);
    git(root, ["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Edit note"], "2026-02-02T03:04:05Z");
    assert.equal(readBlogSources(blogRoot)[0].data.createdAt.toISOString(), "2026-01-02T03:04:05.000Z");
    mkdirSync(join(blogRoot, "朋友圈"));
    const renamed = join(blogRoot, "朋友圈", "renamed.md");
    renameSync(original, renamed);
    git(root, ["add", "."]);
    git(root, ["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Move note"], "2026-03-02T03:04:05Z");
    const [moved] = readBlogSources(blogRoot);
    assert.equal(moved.data.createdAt.toISOString(), "2026-01-02T03:04:05.000Z");
    assert.equal(moved.data.date.toISOString(), "2026-01-02T03:04:05.000Z");
    assert.equal(moved.filePath, "Blog/朋友圈/renamed.md");
    const extra = join(blogRoot, "朋友圈", "new.md");
    writeFileSync(extra, "# New note");
    git(root, ["add", "."]);
    git(root, ["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Add note"], "2026-04-02T03:04:05Z");
    assert.equal(createBlogCreationReader(blogRoot)(extra).toISOString(), "2026-04-02T03:04:05.000Z");
    const untracked = join(blogRoot, "朋友圈", "untracked.md");
    writeFileSync(untracked, "# Untracked note");
    assert.equal(createBlogCreationReader(blogRoot)(untracked).toISOString(), statSync(untracked).birthtime.toISOString());
  } finally { rmSync(root, { recursive: true, force: true }); }
});
