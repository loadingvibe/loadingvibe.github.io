import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { blogDirectoryIcon, listBlogDirectories } from "../src/lib/blog-directories.mjs";

test("catalog follows exact top-level folder names, including empty folders and renames", () => {
  const root = mkdtempSync(join(tmpdir(), "blog-directories-"));
  try {
    for (const name of ["2026年知识库", "朋友圈", "旅行 10", "旅行 2", ".private", "_drafts", "note.assets"]) {
      mkdirSync(join(root, name));
    }
    mkdirSync(join(root, "2026年知识库", "子目录"));
    writeFileSync(join(root, "README.md"), "Author docs");
    assert.deepEqual(listBlogDirectories(root), ["2026年知识库", "旅行 2", "旅行 10", "朋友圈"]);
    renameSync(join(root, "朋友圈"), join(root, "日常"));
    mkdirSync(join(root, "新门类"));
    const names = listBlogDirectories(root);
    assert.ok(names.includes("日常") && names.includes("新门类"));
    assert.ok(!names.includes("朋友圈"));
    assert.equal(blogDirectoryIcon("2026年知识库"), "book");
    assert.equal(blogDirectoryIcon("朋友圈"), "people");
    assert.equal(blogDirectoryIcon("新门类"), "folder");
    assert.deepEqual(listBlogDirectories(join(root, "absent")), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
