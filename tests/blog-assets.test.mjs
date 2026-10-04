import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { finished } from "node:stream/promises";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import {
  getBlogAssetFile, listBlogAssets, rehypeBlogAssets, remarkBlogAssets, resolveBlogAssetUrl,
} from "../src/lib/blog-assets.mjs";
import blogAssetsIntegration, { createBlogAssetMiddleware } from "../src/integrations/blog-assets.mjs";

let temporary;
let root;
let source;
let image;
let expected;
before(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), "blog-assets-"));
  root = path.join(temporary, "Blog");
  source = path.join(root, "中文目录", "笔记 一.md");
  image = path.join(root, "中文目录", "笔记 一.assets", "图片 空格.png");
  await mkdir(path.dirname(image), { recursive: true });
  await mkdir(path.join(root, "attachments"), { recursive: true });
  await mkdir(path.join(root, "_drafts"), { recursive: true });
  await writeFile(source, "# note");
  await writeFile(image, "test-image-bytes");
  await writeFile(path.join(path.dirname(image), "原始资料.txt"), "downloadable text attachment");
  await writeFile(path.join(root, "draft.txt"), "---\ndraft: true\n---\nprivate draft body");
  await writeFile(path.join(root, "中文目录", "正文.TXT"), "public article body");
  await writeFile(path.join(root, "README.txt"), "authoring instructions");
  await writeFile(path.join(root, "attachments", "唯一.jpg"), "unique-image");
  await writeFile(path.join(root, "attachments", "讲义.pdf"), "%PDF-fixture");
  await writeFile(path.join(root, "attachments", "视频.mp4"), "video-content");
  await writeFile(path.join(root, "attachments", "比例.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160"></svg>');
  await writeFile(path.join(root, "_drafts", "秘密.png"), "private");
  await writeFile(path.join(root, ".secret.png"), "private");
  await writeFile(path.join(temporary, "outside.png"), "private");
  await symlink(path.join(temporary, "outside.png"), path.join(root, "outside.png"));
  await symlink(image, path.join(root, "inside-link.png"));
  await symlink(temporary, path.join(root, "escape"));
  expected = "/blog-assets/" + ["中文目录", "笔记 一.assets", "图片 空格.png"].map(encodeURIComponent).join("/");
});
after(async () => { await rm(temporary, { recursive: true, force: true }); });

test("resolve Chinese, spaces, encoded URLs, Windows separators, file URLs and cover paths", () => {
  for (const input of [
    "./笔记 一.assets/图片 空格.png", "笔记 一.assets/图片%20空格.png", "笔记 一.assets\\图片 空格.png",
  ]) assert.equal(resolveBlogAssetUrl(input, source, { root }), expected);
  assert.equal(resolveBlogAssetUrl("./笔记 一.assets/图片 空格.png?width=200#preview", source, { root }), expected + "?width=200#preview");
  assert.equal(resolveBlogAssetUrl(pathToFileURL(image).href, source, { root }), expected);
  assert.equal(resolveBlogAssetUrl("/Blog/中文目录/笔记 一.assets/图片 空格.png", source, { root }), expected);
  assert.equal(resolveBlogAssetUrl("唯一.jpg", source, { root }), "/blog-assets/attachments/%E5%94%AF%E4%B8%80.jpg");
});

test("leave public and remote URLs intact and refuse files outside the blog", () => {
  for (const input of ["/assets/logo.png", "https://example.com/image.png", "//cdn.example.com/image.png", "data:image/png;base64,abc", "#anchor", "../../outside.png", "../outside.png", "../escape/outside.png"])
    assert.equal(resolveBlogAssetUrl(input, source, { root }), input);
  assert.equal(resolveBlogAssetUrl("./missing.png", source, { root }), "./missing.png");
  assert.equal(resolveBlogAssetUrl("./missing.png", source, { root, allowMissing: true }), "/blog-assets/%E4%B8%AD%E6%96%87%E7%9B%AE%E5%BD%95/missing.png");
  assert.equal(resolveBlogAssetUrl("../escape/missing.png", source, { root, allowMissing: true }), "../escape/missing.png");
});

test("serve only visible attachments inside the root, including after URL decoding", () => {
  assert.equal(getBlogAssetFile(expected, root), image);
  for (const pathname of [
    "/blog-assets/%2E%2E/outside.png", "/blog-assets/%2E%2E%2Foutside.png", "/blog-assets/..\\outside.png",
    "/blog-assets/outside.png", "/blog-assets/inside-link.png", "/blog-assets/escape/outside.png", "/blog-assets/_drafts/秘密.png",
    "/blog-assets/.secret.png", "/blog-assets/中文目录/笔记 一.md", "/blog-assets/%00.png",
    "/blog-assets/draft.txt", "/blog-assets/中文目录/正文.TXT", "/blog-assets/README.txt",
  ]) assert.equal(getBlogAssetFile(pathname, root), undefined, pathname);
  assert.deepEqual(listBlogAssets(root).map((file) => path.relative(root, file)).sort(), [
    "attachments/唯一.jpg", "attachments/比例.svg", "attachments/视频.mp4", "attachments/讲义.pdf",
    "中文目录/笔记 一.assets/图片 空格.png", "中文目录/笔记 一.assets/原始资料.txt",
  ].sort());
});

test("text articles never resolve as attachments, while .assets text files remain downloadable", () => {
  for (const input of ["../draft.txt", "./正文.TXT", "../README.txt", "./future.txt"]) {
    assert.equal(resolveBlogAssetUrl(input, source, { root }), input);
    assert.equal(resolveBlogAssetUrl(input, source, { root, allowMissing: true }), input);
  }
  const assetFile = path.join(path.dirname(image), "原始资料.txt");
  const assetUrl = "/blog-assets/" + path.relative(root, assetFile).split(path.sep).map(encodeURIComponent).join("/");
  assert.equal(resolveBlogAssetUrl("./笔记 一.assets/原始资料.txt", source, { root }), assetUrl);
  assert.equal(getBlogAssetFile(assetUrl, root), assetFile);
});

test("render Markdown references, pasted HTML, Obsidian embeds and missing images without Astro asset imports", async () => {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    remarkPlugins: [[remarkBlogAssets, { root }]],
    rehypePlugins: [[rehypeBlogAssets, { root }]],
  });
  const markdown = [
    "![normal](<./笔记 一.assets/图片 空格.png>)",
    "![reference][local]", "[local]: <./笔记 一.assets/图片 空格.png>",
    '![[唯一.jpg|120x90]]',
    "![spaces](./笔记 一.assets/图片 空格.png)",
    '<img src="./笔记 一.assets/图片 空格.png" width="300" />',
    '<video src="../attachments/视频.mp4" poster="./笔记 一.assets/图片 空格.png" controls></video>',
    '<picture><source srcset="./笔记 一.assets/图片 空格.png 1x, ../attachments/唯一.jpg 2x"></picture>',
    "![[attachments/讲义.pdf]]", "![[attachments/视频.mp4]]",
    "![not-yet-saved](./missing.png)",
    "![typo](./file.pgn)", "![outside](../../outside.png)", "![percent](/assets/half%escape.png)",
    "`![[唯一.jpg]]`", "```text\n![[唯一.jpg]]\n```",
  ].join("\n\n");
  const rendered = await processor.render(markdown, { fileURL: pathToFileURL(source) });
  assert.equal(rendered.metadata.localImagePaths.length, 0);
  assert.equal(rendered.code.includes("__ASTRO_IMAGE_"), false);
  assert.equal((rendered.code.match(new RegExp(expected, "gu")) || []).length, 6);
  assert.match(rendered.code, /width="120" height="90"/u);
  assert.match(rendered.code, /href="\/blog-assets\/attachments\/%E8%AE%B2%E4%B9%89.pdf"/u);
  assert.match(rendered.code, /<video controls preload="metadata" src="\/blog-assets\/attachments\/%E8%A7%86%E9%A2%91.mp4"><\/video>/u);
  assert.match(rendered.code, /\/blog-assets\/%E4%B8%AD%E6%96%87%E7%9B%AE%E5%BD%95\/missing.png/u);
  assert.match(rendered.code, /\/blog-assets\/_unavailable\/file.pgn/u);
  assert.match(rendered.code, /\/blog-assets\/_unavailable\/outside.png/u);
  assert.match(rendered.code, /\/assets\/half%25escape.png/u);
  assert.match(rendered.code, /<code>!\[\[唯一.jpg\]\]<\/code>/u);
});

test("preserve image proportions and re-read dimensions when the attachment changes", async () => {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    remarkPlugins: [[remarkBlogAssets, { root }]],
    rehypePlugins: [[rehypeBlogAssets, { root }]],
  });
  const rendered = await processor.render([
    "![natural](../attachments/比例.svg)",
    '<img src="../attachments/比例.svg" width="120" height="999" alt="width" />',
    '<img src="../attachments/比例.svg" height="50" alt="height" />',
    "![[比例.svg|120x90]]",
  ].join("\n\n"), { fileURL: pathToFileURL(source) });
  assert.match(rendered.code, /alt="natural" width="320" height="160"/u);
  assert.match(rendered.code, /width="120" height="60" alt="width"/u);
  assert.match(rendered.code, /height="50" alt="height" width="100"/u);
  assert.match(rendered.code, /width="120" height="60"/u);
  await writeFile(path.join(root, "attachments", "比例.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>');
  const updated = await processor.render("![updated](../attachments/比例.svg)", { fileURL: pathToFileURL(source) });
  assert.match(updated.code, /alt="updated" width="200" height="200"/u);
});

test("copy safe assets into static output with original paths", async () => {
  const output = path.join(temporary, "dist");
  const integration = blogAssetsIntegration({ root });
  await integration.hooks["astro:build:done"]({ dir: pathToFileURL(output + path.sep), logger: { info() {} } });
  assert.equal(await readFile(path.join(output, "blog-assets", path.relative(root, image)), "utf8"), "test-image-bytes");
  assert.equal(await readFile(path.join(output, "blog-assets", path.relative(root, path.dirname(image)), "原始资料.txt"), "utf8"), "downloadable text attachment");
  await assert.rejects(readFile(path.join(output, "blog-assets", "outside.png")), { code: "ENOENT" });
  for (const article of ["draft.txt", "中文目录/正文.TXT", "README.txt"])
    await assert.rejects(readFile(path.join(output, "blog-assets", article)), { code: "ENOENT" });
});

test("development serves changing assets, HEAD, byte ranges and rejects private requests", async () => {
  const middleware = createBlogAssetMiddleware(root);
  async function requestAsset(url, options = {}) {
    const chunks = [];
    const response = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
    const headers = new Map();
    response.headers = { get: (name) => headers.get(name.toLowerCase()) ?? null };
    response.writeHead = (status, values = {}) => {
      response.status = status;
      response.headersSent = true;
      for (const [name, value] of Object.entries(values)) headers.set(name.toLowerCase(), String(value));
    };
    const done = finished(response);
    await middleware({ url, method: options.method || "GET", headers: options.headers || {} }, response, () => {
      response.writeHead(404); response.end("Not found");
    });
    await done;
    response.text = () => Buffer.concat(chunks).toString();
    return response;
  }
  let response = await requestAsset(expected);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "no-cache");
  assert.equal(await response.text(), "test-image-bytes");
  response = await requestAsset(expected, { method: "HEAD" });
  assert.equal(response.headers.get("content-length"), "16");
  assert.equal(await response.text(), "");
  response = await requestAsset(expected, { headers: { range: "bytes=5-9" } });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 5-9/16");
  assert.equal(await response.text(), "image");
  response = await requestAsset(expected, { headers: { range: "bytes=-5" } });
  assert.equal(await response.text(), "bytes");
  response = await requestAsset(expected, { headers: { range: "bytes=100-200" } });
  assert.equal(response.status, 416);
  await writeFile(image, "updated");
  assert.equal(await (await requestAsset(expected)).text(), "updated");
  assert.equal((await requestAsset("/blog-assets/outside.png")).status, 404);
  assert.equal((await requestAsset("/blog-assets/draft.txt")).status, 404);
  assert.equal((await requestAsset("/blog-assets/中文目录/正文.TXT")).status, 404);
  const textAssetUrl = "/blog-assets/" + ["中文目录", "笔记 一.assets", "原始资料.txt"].map(encodeURIComponent).join("/");
  assert.equal(await (await requestAsset(textAssetUrl)).text(), "downloadable text attachment");
  assert.equal((await requestAsset(expected, { method: "POST" })).status, 405);
});
