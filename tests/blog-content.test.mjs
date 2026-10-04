import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { encodeBlogRoute, isBlogSource, readBlogDocument, readBlogSources, resolveBlogEntries } from "../src/lib/blog-content.mjs";

function entry(path, text) {
  return { id: path, filePath: `Blog/${path}`, ...readBlogDocument(text, path) };
}

test("a plain Chinese or English note needs no frontmatter", () => {
  const note = readBlogDocument("\uFEFF# 初识数据类型\r\n\r\n正文和 **重点**。", "Python learning/初识数据类型.MD");
  assert.equal(note.data.title, "初识数据类型");
  assert.equal(note.data.slug, "python-learning/初识数据类型");
  assert.equal(note.data.category, "笔记");
  assert.equal(note.data.draft, false);
  assert.ok(note.data.summary.includes("正文和 重点"));
  assert.equal(readBlogDocument("Plain text", "notes/My note.txt").data.title, "My note");
  assert.equal(readBlogDocument("", "blank.markdown").data.summary, "blank的笔记。");
});

test("YAML Chinese fields and flexible tags, booleans and dates normalize", () => {
  const { data } = readBlogDocument(`---
标题: 学习记录
网址: /blog/Python/初识 数据类型/
分类: 自定义分类
标签: Python，学习;笔记|Python
草稿: "否"
推荐: yes
日期: 2026年10月4日
未知字段: [任意, 内容]
---
正文`, "笔记.md");
  assert.equal(data.slug, "python/初识-数据类型");
  assert.equal(data.category, "自定义分类");
  assert.deepEqual(data.tags, ["Python", "学习", "笔记"]);
  assert.equal(data.draft, false);
  assert.equal(data.featured, true);
  assert.equal(data.date.toISOString(), "2026-10-03T16:00:00.000Z");
});

test("JSON and TOML metadata preserve the Markdown body", () => {
  const json = readBlogDocument('---\n{"title":"JSON note","tags":["A",2,{"name":"B"}]}\n---\n## Section\nText', "a.md");
  assert.equal(json.data.title, "JSON note");
  assert.deepEqual(json.data.tags, ["A", "2", "B"]);
  assert.equal(json.body, "## Section\nText");
  const toml = readBlogDocument('+++\ntitle = "TOML note"\ndraft = true\n+++\nText', "a.markdown");
  assert.equal(toml.data.title, "TOML note");
  assert.equal(toml.data.draft, true);
  assert.equal(toml.body, "Text");
});

test("leading Markdown horizontal rules never consume an ordinary introduction", () => {
  for (const body of ["---\n# 标题\n第一段\n---\n第二段", "---\n第一段\n---\n第二段"]) {
    const note = readBlogDocument(body, "note.md");
    assert.equal(note.body, body);
    assert.equal(note.data.draft, false);
    assert.ok(note.data.summary.includes("第一段"));
  }
  assert.equal(readBlogDocument('---\n"title": Quoted key\n---\nBody', "note.md").data.title, "Quoted key");
});

test("unfinished metadata previews as a draft and malformed values never take down other notes", () => {
  for (const text of ['---\ntitle: "unfinished\n---\nBody', '---\ntags: [unfinished\n---\nBody', '---\ntitle: unfinished\nBody']) {
    const note = readBlogDocument(text, "note.md");
    assert.equal(note.data.draft, true);
    assert.ok(note.warnings.length);
  }
  const note = readBlogDocument('---\ndate: 2026/02/30\ntitle: 123\ntags: {bad: shape}\ndraft: unsure\n---\nBody', "note.md");
  assert.equal(note.data.title, "123");
  assert.equal(note.data.date, undefined);
  assert.deepEqual(note.data.tags, []);
  assert.equal(note.data.draft, true);
  assert.equal(readBlogDocument('---\ndate: 2026-02-30\n---\nBody', "note.md").data.date, undefined);
  assert.equal(readBlogDocument('---\ndate: 2026-02-30T12:00:00Z\n---\nBody', "note.md").data.date, undefined);
  assert.doesNotThrow(() => readBlogDocument('---\ntitle: &self\n  text: *self\n---\n# Fallback', "note.md"));
});

test("copying a note keeps both articles, their distinct URLs and distinct identifiers", () => {
  const text = "---\nslug: shared\ncatalogNo: F-005\naliases: [shared, old, old]\n---\nIdentical body";
  const sources = [entry("03-中文.md", text), entry("02-English.md", text), entry("03-中文.txt", text)];
  const resolved = resolveBlogEntries(sources);
  assert.equal(resolved.length, 3);
  assert.equal(resolved[0].data.slug, "shared");
  assert.equal(new Set(resolved.map((note) => note.data.slug)).size, 3);
  assert.equal(new Set(resolved.map((note) => note.data.catalogNo)).size, 3);
  assert.ok(resolved.every((note) => note.body === "Identical body"));
  assert.deepEqual(resolved, resolveBlogEntries([...sources].reverse()));
  assert.equal(resolved.flatMap((note) => note.data.aliases).filter((alias) => alias === "old").length, 1);
});

test("article URLs take priority over aliases and Unicode paths are encoded by segment", () => {
  const resolved = resolveBlogEntries([
    entry("a.md", "---\nslug: 中文/文章\naliases: second\n---\nA"),
    entry("b.md", "---\nslug: second\n---\nB"),
  ]);
  assert.deepEqual(resolved[0].data.aliases, []);
  assert.equal(encodeBlogRoute(resolved[0].data.slug), "%E4%B8%AD%E6%96%87/%E6%96%87%E7%AB%A0");
});

test("discover nested .md, .markdown and .txt while ignoring author docs and attachment notes", () => {
  const root = mkdtempSync(join(tmpdir(), "blog-content-"));
  try {
    mkdirSync(join(root, "中文", "note.assets"), { recursive: true });
    for (const filename of ["a.MD", "English.MARKDOWN", "text.TXT", "README.md", "_draft.md", ".hidden.md"]) writeFileSync(join(root, filename), "# Note");
    writeFileSync(join(root, "中文", "笔记.md"), "# 笔记");
    writeFileSync(join(root, "中文", "note.assets", "attachment.txt"), "Attachment");
    const sources = readBlogSources(root);
    assert.equal(sources.length, 4);
    assert.equal(new Set(sources.map((note) => note.data.catalogNo)).size, 4);
    assert.ok(sources.some((note) => note.filePath === "Blog/中文/笔记.md"));
    assert.equal(isBlogSource("../outside.md"), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
