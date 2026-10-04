import assert from "node:assert/strict";
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import sharp from "sharp";
import { formatDeploymentBuild, normalizeDeploymentTime, readDeploymentBuild } from "./src/lib/deployment-build.mjs";
import { encodeBlogRoute, readBlogSources } from "./src/lib/blog-content.mjs";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const buildRoot = resolve(projectRoot, "dist");
const blogRoot = resolve(projectRoot, "Blog");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

if (!existsSync(buildRoot) || !statSync(buildRoot).isDirectory()) {
  throw new Error("Missing dist/. Run npm run build first.");
}

// An existing file cannot be a Git working directory. Use it for isolated
// helper cases so a locally fetched deployment ref never affects the result.
const unavailableGitDirectory = fileURLToPath(import.meta.url);
const deploymentFixture = "2030-01-02T03:04:05+08:00";
assert.equal(normalizeDeploymentTime(deploymentFixture), "2030-01-01T19:04:05.000Z");
assert.equal(normalizeDeploymentTime("2024-02-29T00:00:00Z"), "2024-02-29T00:00:00.000Z");
assert.deepEqual(readDeploymentBuild({
  env: { SITE_DEPLOYMENT_BUILD_TIME: deploymentFixture },
  cwd: unavailableGitDirectory,
}), { builtAt: "2030-01-01T19:04:05.000Z", source: "deployment-build" });
for (const invalidTime of [
  "", "not-a-date", "2026-10-03T04:05:00", "2026-13-03T04:05:00Z",
  "2026-02-30T00:00:00Z", "2026-02-29T00:00:00Z", "2026-10-03T24:00:00Z",
]) {
  assert.equal(normalizeDeploymentTime(invalidTime), null, `Invalid deployment time accepted: ${invalidTime}`);
  assert.throws(() => readDeploymentBuild({
    env: { SITE_DEPLOYMENT_BUILD_TIME: invalidTime },
    cwd: unavailableGitDirectory,
  }), /SITE_DEPLOYMENT_BUILD_TIME/u);
}
assert.deepEqual(readDeploymentBuild({ env: {}, cwd: unavailableGitDirectory }), {
  builtAt: null, source: "unrecorded",
}, "A local build without a deployment record must not substitute the current time.");
assert.equal(formatDeploymentBuild(null), "尚无部署记录");
assert.equal(formatDeploymentBuild("2026-10-03T16:05:00.000Z"), "2026/10/04 00:05");

// The artifact is authoritative: origin/gh-pages may be fetched or updated
// between build and verification, so do not recompute its expected timestamp.
const deploymentManifestPath = resolve(buildRoot, "deployment-build.json");
if (!existsSync(deploymentManifestPath)) {
  throw new Error("Static build is missing dist/deployment-build.json.");
}
const deploymentManifest = JSON.parse(readFileSync(deploymentManifestPath, "utf8"));
assert.ok(deploymentManifest && typeof deploymentManifest === "object" && !Array.isArray(deploymentManifest),
  "Deployment build manifest must be an object.");
assert.ok(["deployment-build", "published-record", "deployment-commit", "unrecorded"].includes(deploymentManifest.source),
  "Deployment build manifest has an unknown timestamp source.");
assert.ok(deploymentManifest.builtAt === null ||
  (typeof deploymentManifest.builtAt === "string" &&
   normalizeDeploymentTime(deploymentManifest.builtAt) === deploymentManifest.builtAt),
"Deployment build manifest must contain a canonical ISO timestamp or null.");
assert.equal(deploymentManifest.builtAt === null, deploymentManifest.source === "unrecorded",
  "Only an unrecorded deployment may omit its timestamp.");
if (process.env.SITE_DEPLOYMENT_BUILD_TIME !== undefined) {
  assert.equal(deploymentManifest.builtAt, normalizeDeploymentTime(process.env.SITE_DEPLOYMENT_BUILD_TIME),
    "Build artifact must preserve the deployment timestamp injected by CI.");
  assert.equal(deploymentManifest.source, "deployment-build");
}

function listFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = prefix ? join(prefix, entry.name) : entry.name;
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listFiles(absolutePath, relativePath);
    }

    return entry.isFile() ? [relativePath.replaceAll("\\", "/")] : [];
  });
}

function loadBlogSources() {
  if (!existsSync(blogRoot) || !statSync(blogRoot).isDirectory()) {
    throw new Error("Missing Blog/ author content directory.");
  }

  // Share parsing, fallback metadata and collision resolution with the build.
  // Verification must not reject an input that the authoring loader accepts.
  return readBlogSources(blogRoot).map(({ id, filePath, data, body }) => {
    const topLevelDirectory = id.split("/")[0];
    return {
      sourcePath: id,
      sourceFilePath: filePath,
      slug: data.slug,
      href: `/blog/${encodeBlogRoute(data.slug)}/`,
      catalogNo: data.catalogNo,
      createdAt: data.date?.getTime() ?? 0,
      navigationSection: ["知识库", "朋友圈"].includes(topLevelDirectory)
        ? topLevelDirectory
        : data.category === "生活" ? "朋友圈" : "知识库",
      aliases: data.aliases,
      draft: data.draft,
      body,
    };
  });
}

function resolveRequestFile(pathname) {
  const requestedPath = resolve(buildRoot, pathname.replace(/^\/+/, ""));
  const pathFromRoot = relative(buildRoot, requestedPath);

  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
    return { status: 403 };
  }

  if (existsSync(requestedPath)) {
    const stats = statSync(requestedPath);

    if (stats.isFile()) {
      return { status: 200, filePath: requestedPath };
    }

    if (stats.isDirectory()) {
      const directoryIndex = join(requestedPath, "index.html");
      if (existsSync(directoryIndex) && statSync(directoryIndex).isFile()) {
        return { status: 200, filePath: directoryIndex };
      }
    }
  }

  if (!extname(requestedPath)) {
    const htmlFile = requestedPath + ".html";
    if (existsSync(htmlFile) && statSync(htmlFile).isFile()) {
      return { status: 200, filePath: htmlFile };
    }
  }

  return { status: 404 };
}

const builtFiles = listFiles(buildRoot);
const blogSources = loadBlogSources();
const publishedBlogSources = blogSources.filter((source) => !source.draft);
const sitemapFiles = builtFiles.filter((relativePath) => {
  const filename = relativePath.split("/").at(-1);
  return filename && /^sitemap.*\.xml$/i.test(filename);
});

const claimedBlogRoutes = new Map();
const claimedCatalogNumbers = new Map();
for (const source of blogSources) {
  const existingCatalogSource = claimedCatalogNumbers.get(source.catalogNo);
  if (existingCatalogSource) {
    throw new Error(
      `Blog catalog collision: ${existingCatalogSource} and ${source.sourceFilePath} both use ${source.catalogNo}.`,
    );
  }
  claimedCatalogNumbers.set(source.catalogNo, source.sourceFilePath);

  // Claims are keyed only by public URLs, never by Markdown body text. Identical prose in two
  // different source files must therefore remain two independently verified posts.
  for (const [index, route] of [source.slug, ...source.aliases].entries()) {
    const claim = index === 0 ? "slug" : "alias";
    const existing = claimedBlogRoutes.get(route);
    if (existing) {
      throw new Error(
        `Blog URL collision: ${existing.sourceFilePath} (${existing.claim}) and ` +
          `${source.sourceFilePath} (${claim}) both claim /blog/${route}/. ` +
          "The content loader must resolve route collisions before emitting pages.",
      );
    }
    claimedBlogRoutes.set(route, { claim, sourceFilePath: source.sourceFilePath });
  }
}

if (!builtFiles.includes("index.html")) {
  throw new Error("Static build is missing dist/index.html.");
}
if (!builtFiles.some((filename) => filename.endsWith(".js"))) {
  throw new Error("Static build is missing the compiled JavaScript bundle.");
}
if (!builtFiles.some((filename) => filename.endsWith(".css"))) {
  throw new Error("Static build is missing the compiled CSS bundle.");
}
if (sitemapFiles.length === 0) {
  throw new Error("Static build is missing a sitemap XML file.");
}

const indexHtml = readFileSync(resolve(buildRoot, "index.html"), "utf8");
const blogEntryHref = indexHtml.match(/data-blog-entry="([^"]+)"/u)?.[1];
const configuredEntry = publishedBlogSources.find((source) => source.catalogNo === "F-004");
if (!publishedBlogSources.some((source) => blogEntryHref === source.href) ||
    (configuredEntry && blogEntryHref !== configuredEntry.href)) {
  throw new Error("Homepage blog entry must link directly to the configured published reading page.");
}
if (indexHtml.includes("chatgpt.site") || /<meta[^>]+http-equiv=["']?refresh/i.test(indexHtml)) {
  throw new Error("Static build must host the site directly, not redirect elsewhere.");
}
const homepageScriptMatches = [
  ...indexHtml.matchAll(/<script[^>]+type="module"[^>]+src="\/(?:_astro\/)?([^"]+\.js)"/gi),
];
if (homepageScriptMatches.length === 0) {
  throw new Error("Static homepage is missing its compiled module script.");
}
const homepageScript = homepageScriptMatches
  .map((match) => {
    const scriptPath = match[1].startsWith("_astro/") ? match[1] : `_astro/${match[1]}`;
    return readFileSync(resolve(buildRoot, scriptPath), "utf8");
  })
  .join("\n");
for (const marker of ["comments.loadingvibe.com", "requestAnimationFrame", "currentTime"]) {
  if (!homepageScript.includes(marker)) {
    throw new Error(`Compiled homepage script is missing runtime marker: ${marker}`);
  }
}
for (const removedMarker of ["一册未装订的生活", "href=\"/photos/\"", "href=\"/leaves/\""]) {
  if (indexHtml.includes(removedMarker)) {
    throw new Error(`Static homepage still contains removed marker: ${removedMarker}`);
  }
}

const sitemapXml = sitemapFiles
  .map((relativePath) => readFileSync(resolve(buildRoot, relativePath), "utf8"))
  .join("\n");

if (!/<(?:urlset|sitemapindex)\b/i.test(sitemapXml)) {
  throw new Error("Discovered sitemap files do not contain a sitemap document.");
}
if (sitemapXml.includes("<loc>https://loadingvibe.com/blog/</loc>")) {
  throw new Error("Sitemap must not contain the retired blog catalog compatibility redirect.");
}
for (const source of publishedBlogSources) {
  const route = source.href;
  if (!sitemapXml.includes(route)) {
    throw new Error(`Sitemap is missing ${route} generated from Blog/${source.sourcePath}.`);
  }

  for (const alias of source.aliases) {
    const aliasUrl = new URL(`/blog/${encodeBlogRoute(alias)}/`, "https://loadingvibe.com").toString();
    if (sitemapXml.includes(aliasUrl)) {
      throw new Error(`Sitemap contains noindex compatibility alias instead of only canonical URLs: ${aliasUrl}`);
    }
  }
}

for (const removedRoute of ["/blog/README/"]) {
  if (sitemapXml.includes(removedRoute)) {
    throw new Error(`Sitemap contains internal author documentation: ${removedRoute}`);
  }
}

for (const route of ["/about/", "/marginalia/"]) {
  if (!sitemapXml.includes(route)) {
    throw new Error(`Sitemap is missing the library route ${route}.`);
  }
}
for (const removedRoute of ["/photos/", "/leaves/"]) {
  if (sitemapXml.includes(removedRoute)) {
    throw new Error(`Sitemap still contains removed route ${removedRoute}.`);
  }
}

const server = createServer((request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathname = decodeURIComponent(requestUrl.pathname);
    const result = resolveRequestFile(pathname);

    if (!result.filePath) {
      response.writeHead(result.status).end();
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(result.filePath).toLowerCase()] ?? "application/octet-stream",
    });
    createReadStream(result.filePath).pipe(response);
  } catch (error) {
    response.writeHead(400).end(error instanceof Error ? error.message : "Bad request");
  }
});

await new Promise((resolveListening, rejectListening) => {
  server.once("error", rejectListening);
  server.listen(0, "127.0.0.1", resolveListening);
});

const address = server.address();
if (!address || typeof address === "string") {
  server.close();
  throw new Error("Unable to determine smoke-test server address.");
}

const baseUrl = "http://127.0.0.1:" + address.port;
let checkedRoutes = 0;
let checkedBlogImages = 0;
const imageMarkdown = await createMarkdownProcessor({ syntaxHighlight: false, smartypants: false });

function htmlAttributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([^\s=<>/]+)="([^"]*)"/gu)].map(([, name, value]) => [
    name,
    value.replace(/&(?:#(x[0-9a-f]+|\d+)|amp|quot|apos|lt|gt);/giu, (entity, numeric) => {
      if (numeric) return String.fromCodePoint(Number.parseInt(numeric.replace(/^x/iu, ""), /^x/iu.test(numeric) ? 16 : 10));
      return { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" }[entity.toLowerCase()];
    }),
  ]));
}

function markdownContentHtml(html) {
  const opening = /<div\b[^>]*class="markdown-content"[^>]*>/u.exec(html);
  if (!opening) throw new Error("Reading page is missing its Markdown content container.");
  const start = opening.index + opening[0].length;
  const divTags = /<\/?div\b[^>]*>/gu;
  divTags.lastIndex = start;
  let depth = 1;
  for (let match; (match = divTags.exec(html));) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(start, match.index);
  }
  throw new Error("Reading page has an unclosed Markdown content container.");
}

function hasHtmlAttribute(tag, name) {
  return new RegExp(`\\s${name}(?:\\s|=|/?>)`, "u").test(tag);
}

function htmlElementsWithAttribute(html, attribute) {
  const openings = [...html.matchAll(/<([a-z][\w:-]*)\b[^>]*>/giu)]
    .filter(([tag]) => hasHtmlAttribute(tag, attribute));
  return openings.map((opening) => {
    const tagName = opening[1];
    const tags = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "giu");
    tags.lastIndex = opening.index + opening[0].length;
    let depth = 1;
    for (let match; (match = tags.exec(html));) {
      depth += match[0].startsWith("</") ? -1 : 1;
      if (depth === 0) return html.slice(opening.index, tags.lastIndex);
    }
    throw new Error(`Reading page has an unclosed ${attribute} element.`);
  });
}

function verifyBookFooter(html, context, { compact }) {
  const footers = [...html.matchAll(/<footer\b[^>]*>[\s\S]*?<\/footer>/gu)]
    .map(([footer]) => footer)
    .filter((footer) => (htmlAttributes(footer.match(/^<footer\b[^>]*>/u)[0]).class ?? "")
      .split(/\s+/u).includes("book-colophon"));
  assert.equal(footers.length, 1, `${context} must render exactly one book footer.`);
  const footer = footers[0];
  const footerClasses = (htmlAttributes(footer.match(/^<footer\b[^>]*>/u)[0]).class ?? "").split(/\s+/u);
  assert.equal(footerClasses.includes("book-colophon--compact"), compact,
    `${context} has the wrong footer variant.`);
  const labels = [...footer.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>/gu)].map(([, contents]) => visibleText(contents));
  if (compact) {
    assert.deepEqual(labels, ["LAST BUILD"], `${context} compact footer must only show LAST BUILD metadata.`);
    for (const removedMarker of ["LOADINGVIBE / END", "STATUS", "FOLIOS"]) {
      assert.ok(!footer.includes(removedMarker), `${context} compact footer still shows ${removedMarker}.`);
    }
  } else {
    assert.ok(footer.includes("LOADINGVIBE / END") && labels.includes("STATUS"),
      `${context} must retain its existing non-blog footer structure.`);
    assert.equal(labels.filter((label) => label === "LAST BUILD").length, 1,
      `${context} must show LAST BUILD exactly once.`);
  }
  assert.ok(/<h2\b[^>]*>下次见。<\/h2>/u.test(footer), `${context} footer is missing its farewell.`);
  const footerLinks = [...footer.matchAll(/<a\b[^>]*>/gu)].map(([tag]) => htmlAttributes(tag).href);
  assert.deepEqual(footerLinks, [
    "/rss.xml", "https://github.com/loadingvibe", "mailto:8212230801@csu.edu.cn", "#main-content",
  ], `${context} footer must preserve its four subscription/contact/top links.`);
  assert.ok(/<p\b[^>]*class="book-colophon__note"[^>]*>/u.test(footer) &&
    visibleText(footer).includes("文字、代码与仍在形成的想法，会在这里继续更新。"),
  `${context} footer must preserve its closing note.`);
  const times = [...footer.matchAll(/<time\b[^>]*>([\s\S]*?)<\/time>/gu)];
  if (deploymentManifest.builtAt === null) {
    assert.equal(times.length, 0, `${context} must not invent a deployment time without a record.`);
    assert.ok(visibleText(footer).includes("尚无部署记录"), `${context} must label an unknown deployment time.`);
  } else {
    assert.equal(times.length, 1, `${context} footer must expose one machine-readable deployment time.`);
    assert.equal(htmlAttributes(times[0][0]).datetime, deploymentManifest.builtAt,
      `${context} footer timestamp differs from deployment-build.json.`);
    assert.equal(visibleText(times[0][1]), formatDeploymentBuild(deploymentManifest.builtAt),
      `${context} footer must display its deployment time in Beijing time.`);
  }
}

function verifyBlogOutlines(source, articleHtml) {
  const context = `Reading page ${source.slug}`;
  // Read the final heading IDs rather than Markdown source lines: examples in
  // fenced code are not headings, and the renderer disambiguates repeated text.
  const headings = [...markdownContentHtml(articleHtml).matchAll(/<h([1-6])\b[^>]*>/gu)]
    .map(([tag, depth]) => ({ id: htmlAttributes(tag).id, depth: Number(depth) }));
  if (headings.some((heading) => !heading.id)) {
    throw new Error(`${context} has a body heading without a linkable ID.`);
  }
  const headingIds = headings.map((heading) => heading.id);
  if (new Set(headingIds).size !== headingIds.length) {
    throw new Error(`${context} has duplicate body heading IDs.`);
  }
  const parentHeadings = new Set();
  const ancestors = [];
  for (const heading of headings) {
    while (ancestors.length && ancestors.at(-1).depth >= heading.depth) ancestors.pop();
    if (ancestors.length) parentHeadings.add(ancestors.at(-1).id);
    ancestors.push(heading);
  }

  const outlines = htmlElementsWithAttribute(articleHtml, "data-article-outline");
  if (outlines.length !== 2) {
    throw new Error(`${context} must render exactly one desktop and one mobile outline.`);
  }
  const outlineIds = new Set();
  const pageIds = [...articleHtml.matchAll(/<[a-z][\w:-]*\b[^>]*>/giu)]
    .map(([tag]) => htmlAttributes(tag).id).filter(Boolean);
  for (const outline of outlines) {
    const tags = [...outline.matchAll(/<[a-z][\w:-]*\b[^>]*>/giu)].map(([tag]) => tag);
    const trees = tags.filter((tag) => hasHtmlAttribute(tag, "data-outline-tree"));
    const treeTag = headings.length ? /^<ol\b/u : /^<p\b/u;
    if (trees.length !== 1 || !treeTag.test(trees[0])) {
      throw new Error(`${context} is missing its server-rendered outline tree.`);
    }
    for (const marker of ["data-outline-visibility", "data-outline-collapse-all"]) {
      const controls = tags.filter((tag) => hasHtmlAttribute(tag, marker));
      if (controls.length !== 1 || !/^<button\b/u.test(controls[0]) || htmlAttributes(controls[0]).type !== "button") {
        throw new Error(`${context} must expose one non-submit ${marker} button per outline.`);
      }
      if (!hasHtmlAttribute(controls[0], "hidden") || !htmlAttributes(controls[0])["aria-label"]) {
        throw new Error(`${context} outline enhancement controls must be named and hidden until JavaScript is ready.`);
      }
      for (const target of (htmlAttributes(controls[0])["aria-controls"] ?? "").split(/\s+/u).filter(Boolean)) {
        if (pageIds.filter((id) => id === target).length !== 1) {
          throw new Error(`${context} has a missing or duplicated outline control target: ${target}.`);
        }
      }
    }
    for (const tag of tags) {
      const id = htmlAttributes(tag).id;
      if (id && (outlineIds.has(id) || pageIds.filter((pageId) => pageId === id).length !== 1)) {
        throw new Error(`${context} repeats an outline ID between desktop and mobile: ${id}.`);
      }
      if (id) outlineIds.add(id);
    }
    const anchorTags = tags.filter((tag) => /^<a\b/u.test(tag));
    if (anchorTags.some((tag) => !hasHtmlAttribute(tag, "data-outline-link"))) {
      throw new Error(`${context} outline still contains an anchor outside its body-heading tree.`);
    }
    const links = anchorTags.map((tag) => htmlAttributes(tag));
    for (const link of links) {
      const slug = link["data-heading-slug"];
      let target;
      try { target = link.href?.startsWith("#") ? decodeURIComponent(link.href.slice(1)) : undefined; }
      catch { throw new Error(`${context} has a malformed outline fragment: ${link.href}.`); }
      if (!slug || target !== slug || !headingIds.includes(slug)) {
        throw new Error(`${context} has an outline link without a matching body heading: ${link.href}.`);
      }
    }
    if (JSON.stringify(links.map((link) => link["data-heading-slug"])) !== JSON.stringify(headingIds)) {
      throw new Error(`${context} outline must list every H1–H6 body heading once, in document order.`);
    }
    const branches = htmlElementsWithAttribute(outline, "data-outline-branch");
    if (branches.length !== parentHeadings.size || branches.some((branch) => {
      const opening = branch.match(/^<details\b[^>]*>/u)?.[0];
      return !opening || !hasHtmlAttribute(opening, "open") || !/<summary\b/u.test(branch);
    })) {
      throw new Error(`${context} outline must use native details/summary for every parent heading.`);
    }
  }
}

function assertImageRatio(actual, original, context) {
  if (!(actual.width > 0 && actual.height > 0 && original.width > 0 && original.height > 0)) {
    throw new Error(`Missing image dimensions: ${context}`);
  }
  // A resized raster can round each dimension by up to one pixel. Compare actual
  // numeric ratios, not only HTML/CSS markers, and allow only that rounding error.
  const crossProductError = Math.abs(actual.width * original.height - actual.height * original.width);
  if (crossProductError > original.width + original.height) {
    throw new Error(`Image aspect ratio changed: ${context} (${original.width}×${original.height} → ${actual.width}×${actual.height}).`);
  }
}

async function verifyBlogImageProportions(source, articleHtml) {
  const sourceFile = resolve(blogRoot, source.sourcePath);
  // Use Astro's own Markdown parser so reference images and fenced examples are
  // interpreted like the build, rather than mistaking Markdown text for images.
  const rendered = await imageMarkdown.render(source.body, { fileURL: sourceFile });
  const sourceImages = [...rendered.code.matchAll(/<img\b[^>]*>/gu)].map(([tag]) => htmlAttributes(tag));
  const builtImages = [...markdownContentHtml(articleHtml).matchAll(/<img\b[^>]*>/gu)].map(([tag]) => htmlAttributes(tag));
  if (sourceImages.length !== builtImages.length) {
    throw new Error(`Markdown image count changed while building ${source.sourceFilePath}.`);
  }

  for (const [index, image] of sourceImages.entries()) {
    if (!image.__ASTRO_IMAGE_) continue;
    const originalImage = JSON.parse(image.__ASTRO_IMAGE_);
    if (!rendered.metadata.localImagePaths.includes(originalImage.src)) continue;
    const builtImage = builtImages[index];
    if ((builtImage.alt ?? "") !== (originalImage.alt ?? "")) {
      throw new Error(`Markdown image order or alt text changed in ${source.sourceFilePath}.`);
    }
    const metadata = await sharp(resolve(dirname(sourceFile), originalImage.src)).metadata();
    const originalSize = metadata.autoOrient ?? metadata;
    assertImageRatio({ width: Number(builtImage.width), height: Number(builtImage.height) }, originalSize, `${source.sourceFilePath}: HTML image ${index + 1}`);
    const assetPaths = new Set([
      builtImage.src,
      ...(builtImage.srcset ?? "").split(",").map((candidate) => candidate.trim().split(/\s+/u)[0]).filter(Boolean),
    ]);
    for (const assetPath of assetPaths) {
      if (!assetPath?.startsWith("/") || assetPath.startsWith("//")) {
        throw new Error(`Local Markdown image did not produce a local build asset: ${source.sourceFilePath}.`);
      }
      const asset = resolveRequestFile(decodeURIComponent(new URL(assetPath, baseUrl).pathname));
      if (!asset.filePath) throw new Error(`Missing built Markdown image: ${assetPath}`);
      const assetMetadata = await sharp(asset.filePath).metadata();
      const assetSize = assetMetadata.autoOrient ?? assetMetadata;
      assertImageRatio(assetSize, originalSize, `${source.sourceFilePath}: ${assetPath}`);
      if (assetSize.width > originalSize.width + 1 || assetSize.height > originalSize.height + 1) {
        throw new Error(`Markdown image was enlarged instead of only downscaled: ${assetPath}`);
      }
    }
    checkedBlogImages += 1;
  }
}

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchOk(pathname) {
  const response = await fetch(baseUrl + pathname);
  checkedRoutes += 1;

  if (!response.ok) {
    throw new Error("Smoke test failed for " + pathname + ": HTTP " + response.status);
  }

  return response;
}

async function checkHtml(pathname, options) {
  const response = await fetchOk(pathname);
  const html = await response.text();
  const text = visibleText(html);

  for (const marker of options.text ?? []) {
    if (!text.includes(marker)) {
      throw new Error("Smoke test failed for " + pathname + ": static text marker missing: " + marker);
    }
  }

  for (const marker of options.html ?? []) {
    if (!html.includes(marker)) {
      throw new Error("Smoke test failed for " + pathname + ": HTML marker missing: " + marker);
    }
  }
}

async function checkText(pathname, markers) {
  const response = await fetchOk(pathname);
  const body = await response.text();

  for (const marker of markers) {
    if (!body.includes(marker)) {
      throw new Error("Smoke test failed for " + pathname + ": content marker missing: " + marker);
    }
  }

  return body;
}

async function checkAsset(pathname) {
  const response = await fetchOk(pathname);
  const body = await response.arrayBuffer();

  if (body.byteLength === 0) {
    throw new Error("Smoke test failed for " + pathname + ": asset is empty");
  }
}

async function checkStatus(pathname, expectedStatus) {
  const response = await fetch(baseUrl + pathname, { redirect: "manual" });
  checkedRoutes += 1;

  if (response.status !== expectedStatus) {
    throw new Error(
      `Smoke test failed for ${pathname}: expected HTTP ${expectedStatus}, received ${response.status}`,
    );
  }
}

try {
  await checkHtml("/", {
    html: [
      "<html lang=\"en\">",
      "id=\"main-content\"",
      "data-story-app",
      "data-intro-video",
      "poster=\"/assets/video/intro-background.png\"",
      "muted playsinline webkit-playsinline preload=\"auto\"",
      "/assets/video/story-01.mp4",
      "data-folder-trigger",
      "data-anchor=\"about\" data-video-index=\"0\" data-media-time=\"3.4\"",
      "data-scroll-duration=\"0.45\"",
      "data-scroll-power=\"0.1\"",
      "id=\"comments\"",
      `href="${blogEntryHref}"`,
    ],
    text: ["loadingvibe", "loadingvibelyg@gmail.com", "Hi, I’m Roy", "Open blog", "Comments"],
  });
  await checkHtml("/about/", {
    html: ["id=\"main-content\"", "author-portrait", "persona-shelf", "临时占位图"],
    text: ["关于作者", "此刻的我", "人物图版"],
  });
  verifyBookFooter(readFileSync(resolve(buildRoot, "about/index.html"), "utf8"), "/about/", { compact: false });
  await checkStatus("/photos/", 404);
  await checkStatus("/leaves/", 404);
  await checkHtml("/marginalia/", {
    html: ["id=\"main-content\"", "marginalia-thread", "comments-panel"],
    text: ["评论", "全站旁批簿"],
  });
  verifyBookFooter(readFileSync(resolve(buildRoot, "marginalia/index.html"), "utf8"), "/marginalia/", { compact: false });
  const deploymentResponse = await fetchOk("/deployment-build.json");
  assert.deepEqual(await deploymentResponse.json(), deploymentManifest,
    "Published deployment manifest must match the verified build artifact.");
  await checkHtml("/blog/", {
    html: [
      "http-equiv=\"refresh\"",
      "name=\"robots\" content=\"noindex\"",
      `href="https://loadingvibe.com${blogEntryHref}"`,
    ],
  });
  const retiredCatalog = readFileSync(resolve(buildRoot, "blog/index.html"), "utf8");
  if (["book-catalog", "全书目录", "检索本册正文"].some((marker) => retiredCatalog.includes(marker))) {
    throw new Error("The retired blog catalog UI must not be rendered.");
  }

  for (const source of publishedBlogSources) {
    await checkHtml(source.href, {
      html: [
        "markdown-content",
        "article-reader__rail--archive",
        "article-reader__rail--outline",
        "reader-mobile-tools",
        "blog-sidebar__profile",
        "blog-sidebar__avatar",
        "alt=\"Roy 的头像\"",
        "data-section=\"知识库\"",
        "data-section=\"朋友圈\"",
        "data-article-outline",
        "data-outline-tree",
        "data-outline-visibility",
        "data-outline-collapse-all",
        "book-return-bar",
        "book-return-link",
        ...publishedBlogSources.map((article) => `href="${article.href}"`),
      ],
      text: ["Roy", "知识库", "朋友圈"],
    });
    const articleHtml = readFileSync(resolve(buildRoot, `blog/${source.slug}/index.html`), "utf8");
    const structuredData = articleHtml.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/u)?.[1];
    assert.ok(structuredData, `Reading page ${source.slug} must contain structured article metadata.`);
    assert.equal(JSON.parse(structuredData).identifier, source.catalogNo,
      `Reading page ${source.slug} must retain its assigned catalog number.`);
    if ([...articleHtml.matchAll(/<h2\b[^>]*class="blog-sidebar__name"[^>]*>Roy<\/h2>/gu)].length !== 2) {
      throw new Error(`Reading page ${source.slug} must show Roy in both sidebar profiles.`);
    }
    await verifyBlogImageProportions(source, articleHtml);
    verifyBlogOutlines(source, articleHtml);
    verifyBookFooter(articleHtml, `Reading page ${source.slug}`, { compact: true });
    if (articleHtml.includes("/blog/?directory=") || articleHtml.includes("返回博客目录")) {
      throw new Error(`Reading page ${source.slug} still links to the retired blog catalog.`);
    }
    for (const removedMarker of [
      "blog-breadcrumb", "blog-sidebar__count", "article-archive-tree__directory",
      "blog-article__path", "blog-article__meta", "blog-article__summary",
      "article-neighbors", "article-marginalia", "article-reader__back",
      "comments-panel", "END OF NOTE",
    ]) {
      if (articleHtml.includes(removedMarker)) {
        throw new Error(`Reading page ${source.slug} still renders a removed reading-page element: ${removedMarker}`);
      }
    }
    const commentIslands = [...articleHtml.matchAll(/<astro-island\b[^>]*>/gu)]
      .map(([tag]) => htmlAttributes(tag))
      .filter((attributes) => /(?:^|\/)PagesComments(?:\.|\/)/u.test(attributes["component-url"] ?? ""));
    if (commentIslands.length || /\/marginalia\/f-\d{3}\//iu.test(articleHtml)) {
      throw new Error(`Reading page ${source.slug} must not hydrate article comments or bind an article comment thread.`);
    }
    const returnBars = [...articleHtml.matchAll(/<header\b[^>]*class="[^"]*\bbook-return-bar\b[^"]*"[^>]*>([\s\S]*?)<\/header>/gu)];
    const returnLinks = returnBars.flatMap(([, bar]) => [...bar.matchAll(/<a\b[^>]*>/gu)]
      .map(([tag]) => htmlAttributes(tag))
      .filter((attributes) => (attributes.class ?? "").split(/\s+/u).includes("book-return-link")));
    if (returnBars.length !== 1 || returnLinks.length !== 1 ||
        returnLinks[0].href !== "/?library=1#library" || visibleText(returnBars[0][1]) !== "return") {
      throw new Error(`Reading page ${source.slug} must retain its single top return link to the library.`);
    }
    const postOrder = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
    for (const section of ["知识库", "朋友圈"]) {
      const expectedLinks = publishedBlogSources
        .filter((article) => article.navigationSection === section)
        .sort((left, right) => right.createdAt - left.createdAt || postOrder.compare(left.slug, right.slug))
        .map((article) => article.href);
      const sectionCopies = [...articleHtml.matchAll(new RegExp(
        `<details[^>]*data-section="${section}"[^>]*>([\\s\\S]*?)</details>`, "gu",
      ))];
      if (sectionCopies.length !== 2) {
        throw new Error(`Reading page ${source.slug} must render desktop and mobile ${section} navigation.`);
      }
      for (const [, sectionHtml] of sectionCopies) {
        const actualLinks = [...sectionHtml.matchAll(/href="([^"]+)"/gu)].map((match) => match[1]);
        if (JSON.stringify(actualLinks) !== JSON.stringify(expectedLinks)) {
          throw new Error(`Reading page ${source.slug} ${section} records are not ordered by creation date.`);
        }
      }
    }

    for (const alias of source.aliases) {
      await checkHtml(`/blog/${encodeBlogRoute(alias)}/`, {
        html: [
          "http-equiv=\"refresh\"",
          "name=\"robots\" content=\"noindex\"",
          `href=\"https://loadingvibe.com${source.href}\"`,
        ],
      });
    }
  }

  await checkStatus("/blog/README/", 404);
  await checkStatus("/blog/知识库/README/", 404);
  await checkStatus("/blog/朋友圈/README/", 404);
  await checkHtml("/blog/url-name/", {
    html: ["markdown-content"],
    text: ["url", "当我们希望找到函数"],
  });

  const rss = await checkText(
    "/rss.xml",
    publishedBlogSources.map((source) => source.href),
  );
  if (!/<(?:rss|feed)\b/i.test(rss)) {
    throw new Error("Smoke test failed for /rss.xml: RSS or Atom root element missing");
  }

  for (const source of blogSources.filter((article) => article.draft)) {
    await checkStatus(source.href, 404);
    for (const alias of source.aliases) await checkStatus(`/blog/${encodeBlogRoute(alias)}/`, 404);
    if (rss.includes(source.href) || sitemapXml.includes(source.href) || indexHtml.includes(source.href)) {
      throw new Error(`Production build exposed a draft route: ${source.sourceFilePath}.`);
    }
  }

  await checkText("/robots.txt", ["User-agent:", "Sitemap:"]);
  await checkText("/CNAME", ["loadingvibe.com"]);
  await checkAsset("/assets/brand/you-dian-lai-dian-mark-v1.png");
  await checkAsset("/assets/brand/optimized/mark-192.avif");
  await checkAsset("/assets/brand/loadingvibe-script-source.png");
  await checkAsset("/assets/about/optimized/roy-profile-960.avif");
  await checkAsset("/og-you-dian-lai-dian-v1.png");
  await checkAsset("/assets/video/intro-gaze.mp4");
  await checkAsset("/assets/video/intro-background.png");
  await checkAsset("/assets/video/intro-person-mask.png");
  await checkAsset("/assets/video/intro-person-mask.mp4");
  await checkAsset("/assets/video/story-01.mp4");
  await checkAsset("/assets/video/story-02.mp4");
  await checkAsset("/assets/video/story-03.mp4");
  await checkAsset("/assets/video/story-04.mp4");
  await checkAsset("/assets/video/folder-burst.mp4");

  for (const sitemapFile of sitemapFiles) {
    await fetchOk("/" + sitemapFile);
  }
} finally {
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

process.stdout.write(
  "Static build smoke test passed (" +
    checkedRoutes +
    " routes, " +
    sitemapFiles.length +
    " sitemap file(s), " +
    checkedBlogImages +
    " proportion-preserving Markdown image(s)).\n",
);
