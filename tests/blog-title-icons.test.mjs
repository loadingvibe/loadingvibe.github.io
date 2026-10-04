import assert from "node:assert/strict";
import test from "node:test";
import { assignBlogTitleIcons, BLOG_TITLE_ICONS } from "../src/lib/blog-title-icons.mjs";

function post(sourcePath, createdAt, extra = {}) {
  return { sourcePath, createdAt: new Date(createdAt), ...extra };
}

test("the icon library preserves every reference icon in row-major order", () => {
  const ids = [
    "minimal-lamp", "record-player", "teacup", "potted-plant",
    "picture-frame", "window", "small-sofa", "cat",
    "leaf-lamp", "bookshelf", "radio", "hanging-plant",
    "storage-shelf", "sofa-set",
  ];
  assert.deepEqual(BLOG_TITLE_ICONS.map((icon) => icon.id), ids);
  assert.ok(Object.isFrozen(BLOG_TITLE_ICONS));
  for (const [index, icon] of BLOG_TITLE_ICONS.entries()) {
    assert.ok(Object.isFrozen(icon));
    assert.ok(icon.label);
    assert.equal(icon.src, `/assets/blog/title-icons/${String(index + 1).padStart(2, "0")}-${ids[index]}.svg`);
  }
});

test("fourteen articles get unique icons and the fifteenth restarts the cycle", () => {
  const posts = Array.from({ length: 29 }, (_, index) => post(
    `知识库/article-${index + 1}`,
    new Date(Date.UTC(2026, 0, index + 1)),
  ));
  const icons = [...assignBlogTitleIcons(posts).values()];
  assert.equal(new Set(icons.slice(0, 14)).size, 14);
  assert.deepEqual(icons.slice(0, 14), BLOG_TITLE_ICONS);
  assert.equal(icons[14], BLOG_TITLE_ICONS[0]);
  assert.equal(icons[27], BLOG_TITLE_ICONS[13]);
  assert.equal(icons[28], BLOG_TITLE_ICONS[0]);
});

test("assignment is chronological across folders and independent of input order or slugs", () => {
  const posts = [
    post("朋友圈/second", "2026-02-01", { slug: "older-looking-slug" }),
    post("知识库/third", "2026-03-01", { slug: "a" }),
    post("知识库/first", "2026-01-01", { slug: "z" }),
  ];
  const before = [...posts];
  const icons = assignBlogTitleIcons(posts);
  assert.deepEqual([...icons.keys()], ["知识库/first", "朋友圈/second", "知识库/third"]);
  assert.deepEqual([...assignBlogTitleIcons([...posts].reverse())], [...icons]);
  assert.deepEqual(posts, before, "sorting must not mutate the caller's article list");
  assert.equal(icons.get("朋友圈/second"), BLOG_TITLE_ICONS[1]);
});

test("adding a newer article retains all earlier assignments", () => {
  const posts = [post("知识库/first", "2026-01-01"), post("知识库/second", "2026-02-01")];
  const before = assignBlogTitleIcons(posts);
  const after = assignBlogTitleIcons([post("新门类/new", "2026-04-01"), ...posts]);
  for (const [sourcePath, icon] of before) assert.equal(after.get(sourcePath), icon);
  assert.equal(after.get("新门类/new"), BLOG_TITLE_ICONS[2]);
});

test("creation date takes priority over publication date with a publication-date fallback", () => {
  const posts = [
    post("知识库/first", "2026-01-01", { date: new Date("2026-12-01") }),
    { sourcePath: "知识库/second", date: new Date("2026-02-01") },
    post("知识库/third", "2026-03-01", { date: new Date("2025-01-01") }),
  ];
  assert.deepEqual([...assignBlogTitleIcons(posts).keys()], posts.map((article) => article.sourcePath));
});

test("equal creation dates use natural path order and exact case to break collator ties", () => {
  const posts = ["知识库/10", "知识库/a", "知识库/2", "知识库/A"]
    .map((sourcePath) => post(sourcePath, "2026-01-01"));
  const expected = ["知识库/2", "知识库/10", "知识库/A", "知识库/a"];
  assert.deepEqual([...assignBlogTitleIcons(posts).keys()], expected);
  assert.deepEqual([...assignBlogTitleIcons([...posts].reverse()).keys()], expected);
});

test("older drafts in a preview never shift published icons", () => {
  const published = [post("知识库/first", "2026-02-01"), post("朋友圈/second", "2026-03-01")];
  const drafts = [
    post("知识库/draft-newer", "2026-01-01", { entry: { data: { draft: true } } }),
    post("朋友圈/draft-older", "2025-01-01", { entry: { data: { draft: true } } }),
  ];
  const before = assignBlogTitleIcons(published);
  const preview = assignBlogTitleIcons([...drafts, ...published]);
  for (const [sourcePath, icon] of before) assert.equal(preview.get(sourcePath), icon);
  assert.equal(preview.get("朋友圈/draft-older"), BLOG_TITLE_ICONS[2]);
  assert.equal(preview.get("知识库/draft-newer"), BLOG_TITLE_ICONS[3]);
});

test("an empty blog has no icon assignments", () => {
  assert.equal(assignBlogTitleIcons([]).size, 0);
});
