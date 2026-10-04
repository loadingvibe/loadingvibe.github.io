import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { encodeBlogRoute, readBlogSources } from "../src/lib/blog-content.mjs";
import { rehypeBlogLinks, remarkBlogLinks, resolveBlogLinkUrl } from "../src/lib/blog-links.mjs";

let temporary;
let root;
let source;
let chineseHref;
let textHref;
before(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), "blog-links-"));
  root = path.join(temporary, "Blog");
  source = path.join(root, "写作", "当前.md");
  const fixtures = {
    "写作/当前.md": "# 当前标题",
    "写作/中文 笔记.markdown": "---\nslug: custom/中文\n---\n# 说明",
    "写作/兼容.md": "# one",
    "写作/兼容.txt": "# two",
    "资料/01.md": "---\nslug: shared\n---\n# 说明",
    "资料/notes.txt": "---\nslug: shared\n---\n# 说明",
    "草稿.md": "---\ndraft: true\n---\n# 不公开",
    "组一/同名.md": "# 同名",
    "组二/同名.md": "# 同名",
  };
  for (const [filename, contents] of Object.entries(fixtures)) {
    const file = path.join(root, filename);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents);
  }
  await writeFile(path.join(temporary, "outside.md"), "# private");
  await symlink(path.join(temporary, "outside.md"), path.join(root, "symlink.md"));
  await symlink(temporary, path.join(root, "escape"));
  const entries = readBlogSources(root);
  chineseHref = "/blog/" + encodeBlogRoute(entries.find((entry) => entry.id === "写作/中文 笔记.markdown").data.slug) + "/";
  textHref = "/blog/" + encodeBlogRoute(entries.find((entry) => entry.id === "资料/notes.txt").data.slug) + "/";
});
after(async () => { await rm(temporary, { recursive: true, force: true }); });

test("relative Chinese, space, encoded and nested links use final collision-resolved addresses", () => {
  for (const input of ["./中文 笔记.markdown", "./中文%20笔记.markdown", ".\\中文 笔记.markdown"])
    assert.equal(resolveBlogLinkUrl(input, source, { root }), chineseHref);
  assert.equal(resolveBlogLinkUrl("../资料/notes.txt?mode=read#说明", source, { root }), textHref + "?mode=read#说明");
  assert.equal(resolveBlogLinkUrl("./中文 笔记.markdown#说明", pathToFileURL(source), { root }), chineseHref + "#说明");
  assert.notEqual(textHref, "/blog/shared/", "a colliding source must link to its own page");
});

test("remote, absolute, missing, outside, ambiguous and production draft links remain unchanged", () => {
  for (const input of [
    "https://example.com/note.md", "//example.com/note.md", "/assets/note.md", "/blog/custom/",
    "mailto:writer@example.com", "file:///private/tmp/outside.md", "#说明", "../missing.md",
    "../../outside.md", "%2E%2E/%2E%2E/outside.md", "../symlink.md", "../escape/outside.md",
  ]) assert.equal(resolveBlogLinkUrl(input, source, { root }), input);
  assert.equal(resolveBlogLinkUrl("./中文 笔记.markdown", path.join(temporary, "outside.md"), { root }), "./中文 笔记.markdown");
  assert.equal(resolveBlogLinkUrl("../草稿.md", source, { root, includeDrafts: false }), "../草稿.md");
  assert.match(resolveBlogLinkUrl("../草稿.md", source, { root, includeDrafts: true }), /^\/blog\//u);
  for (const input of ["同名", "./兼容", "不存在"])
    assert.equal(resolveBlogLinkUrl(input, source, { root, wiki: true }), input);
});

test("Obsidian names and vault paths resolve only unique notes and normalize heading anchors", () => {
  assert.equal(resolveBlogLinkUrl("中文 笔记#Heading text", source, { root, wiki: true }), chineseHref + "#heading-text");
  assert.equal(resolveBlogLinkUrl("资料/notes#说明", source, { root, wiki: true }), textHref + "#%E8%AF%B4%E6%98%8E");
  assert.equal(resolveBlogLinkUrl("../资料/notes.txt", source, { root, wiki: true }), textHref);
  assert.equal(resolveBlogLinkUrl("#当前标题", source, { root, wiki: true }), "/blog/%E5%86%99%E4%BD%9C/%E5%BD%93%E5%89%8D/#%E5%BD%93%E5%89%8D%E6%A0%87%E9%A2%98");
});

test("Markdown, reference links, HTML anchors and wiki labels render while code and embeds are preserved", async () => {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    remarkPlugins: [[remarkBlogLinks, { root, includeDrafts: false }]],
    rehypePlugins: [[rehypeBlogLinks, { root, includeDrafts: false }]],
  });
  const markdown = [
    "[中文](<./中文 笔记.markdown#说明>)",
    "[reference][note]\n\n[note]: ../资料/notes.txt#说明",
    '<a href="../资料/notes.txt#说明">HTML</a>',
    "[[中文 笔记#说明|阅读这篇]]",
    "[[同名|保留歧义]] [[../草稿|保持草稿]]",
    "![[中文 笔记]]",
    "`[[中文 笔记]]`",
    "```text\n[[中文 笔记]]\n```",
  ].join("\n\n");
  const rendered = await processor.render(markdown, { fileURL: pathToFileURL(source) });
  const hrefs = [...rendered.code.matchAll(/href="([^"]*)"/gu)].map(([, href]) => decodeURI(href));
  assert.ok(hrefs.includes(decodeURI(chineseHref) + "#说明"));
  assert.equal(hrefs.filter((href) => href === decodeURI(textHref) + "#说明").length, 2);
  assert.ok(rendered.code.includes(`href="${chineseHref}#%E8%AF%B4%E6%98%8E">阅读这篇</a>`));
  assert.ok(rendered.code.includes("[[同名|保留歧义]]"));
  assert.ok(rendered.code.includes("[[../草稿|保持草稿]]"));
  assert.ok(rendered.code.includes("![[中文 笔记]]"));
  assert.ok(rendered.code.includes("<code>[[中文 笔记]]</code>"));
});

test("a subsequent render reads newly changed metadata rather than caching old slugs", async () => {
  const target = path.join(root, "写作", "中文 笔记.markdown");
  const processor = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: [[remarkBlogLinks, { root }]] });
  await writeFile(target, "---\nslug: changed-address\n---\n# 说明");
  try {
    const rendered = await processor.render("[note](<./中文 笔记.markdown>)", { fileURL: pathToFileURL(source) });
    assert.ok(rendered.code.includes('href="/blog/changed-address/"'));
  } finally {
    await writeFile(target, "---\nslug: custom/中文\n---\n# 说明");
  }
});
