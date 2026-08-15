import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const buildRoot = resolve(projectRoot, "dist");
const blogRoot = resolve(projectRoot, "Blog");
const blogGithubRepositoryUrl = "https://github.com/loadingvibe/loadingvibe.github.io";
const blogGithubBranch = "main";
const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
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

function frontmatterBlock(contents, sourcePath) {
  const match = contents.match(/^---[\t ]*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!match) {
    throw new Error(`Blog source is missing YAML frontmatter: ${sourcePath}`);
  }
  return match[1];
}

function frontmatterScalar(frontmatter, key, sourcePath) {
  const match = frontmatter.match(new RegExp(`^${key}:[\\t ]*(.*?)[\\t ]*$`, "mu"));
  if (!match || !match[1]) {
    throw new Error(`Blog source is missing required frontmatter field "${key}": ${sourcePath}`);
  }

  const value = match[1].trim();
  const quote = value.at(0);
  if ((quote === '"' || quote === "'") && value.at(-1) === quote) {
    return value.slice(1, -1);
  }
  return value;
}

function frontmatterList(frontmatter, key) {
  const inline = frontmatter.match(new RegExp(`^${key}:[\\t ]*\\[([^\\]]*)\\][\\t ]*$`, "mu"));
  if (inline) {
    return inline[1]
      .split(",")
      .map((value) => value.trim().replace(/^(["'])(.*)\1$/u, "$2"))
      .filter(Boolean);
  }

  const block = frontmatter.match(new RegExp(`^${key}:[\\t ]*\\r?\\n((?:[\\t ]+-[\\t ]*[^\\r\\n]+(?:\\r?\\n|$))*)`, "mu"));
  if (!block) return [];

  return block[1]
    .split(/\r?\n/u)
    .map((line) => line.match(/^[\t ]+-[\t ]*(.+?)[\t ]*$/u)?.[1] || "")
    .map((value) => value.replace(/^(["'])(.*)\1$/u, "$2"))
    .filter(Boolean);
}

function encodePathSegments(value) {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function githubFileUrl(action, sourceFilePath) {
  return (
    `${blogGithubRepositoryUrl}/${action}/${encodeURIComponent(blogGithubBranch)}/` +
    encodePathSegments(sourceFilePath)
  );
}

function loadBlogSources() {
  if (!existsSync(blogRoot) || !statSync(blogRoot).isDirectory()) {
    throw new Error("Missing Blog/ author content directory.");
  }

  return listFiles(blogRoot)
    .filter((sourcePath) => sourcePath.toLowerCase().endsWith(".md"))
    .filter((sourcePath) => {
      const segments = sourcePath.split("/");
      return basename(sourcePath).toLowerCase() !== "readme.md" && !segments.some((part) => part.startsWith("_"));
    })
    .map((sourcePath) => {
      const contents = readFileSync(resolve(blogRoot, sourcePath), "utf8");
      const frontmatter = frontmatterBlock(contents, sourcePath);
      const slug = frontmatterScalar(frontmatter, "slug", sourcePath);
      const catalogNo = frontmatterScalar(frontmatter, "catalogNo", sourcePath);
      const draftMatch = frontmatter.match(/^draft:[\t ]*(true|false)[\t ]*$/imu);
      const sourceFilePath = `Blog/${sourcePath}`;

      return {
        sourcePath,
        sourceFilePath,
        githubManageUrl: githubFileUrl("blob", sourceFilePath),
        githubDeleteUrl: githubFileUrl("delete", sourceFilePath),
        slug,
        catalogNo,
        aliases: frontmatterList(frontmatter, "aliases"),
        draft: draftMatch?.[1].toLowerCase() === "true",
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
          "No source was discarded; assign a unique slug or alias and rebuild.",
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
if (indexHtml.includes("chatgpt.site") || /<meta[^>]+http-equiv=["']?refresh/i.test(indexHtml)) {
  throw new Error("Static build must host the site directly, not redirect elsewhere.");
}

const sitemapXml = sitemapFiles
  .map((relativePath) => readFileSync(resolve(buildRoot, relativePath), "utf8"))
  .join("\n");

if (!/<(?:urlset|sitemapindex)\b/i.test(sitemapXml)) {
  throw new Error("Discovered sitemap files do not contain a sitemap document.");
}
for (const source of publishedBlogSources) {
  const route = `/blog/${source.slug}/`;
  if (!sitemapXml.includes(route)) {
    throw new Error(`Sitemap is missing ${route} generated from Blog/${source.sourcePath}.`);
  }

  for (const alias of source.aliases) {
    const aliasUrl = new URL(`/blog/${alias}/`, "https://loadingvibe.com").toString();
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

for (const route of ["/about/", "/photos/", "/leaves/", "/marginalia/"]) {
  if (!sitemapXml.includes(route)) {
    throw new Error(`Sitemap is missing the book route ${route}.`);
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

function checkPublishedImagePrivacy() {
  const publicImageRoot = resolve(buildRoot, "assets/about");
  const unsafeMetadataMarkers = [
    "GPSLatitude",
    "GPSLongitude",
    "DateTimeOriginal",
    "LensModel",
    "Apple iPhone",
  ].map((value) => Buffer.from(value, "utf8"));

  for (const relativePath of listFiles(publicImageRoot)) {
    if (!/\.(?:avif|jpe?g)$/iu.test(relativePath)) continue;
    const contents = readFileSync(resolve(publicImageRoot, relativePath));
    if (unsafeMetadataMarkers.some((marker) => contents.includes(marker))) {
      throw new Error(`Published image still contains private capture metadata: ${relativePath}`);
    }
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
      "一册未装订的生活｜有点来电",
      "id=\"main-content\"",
      "id=\"inside-cover\"",
      "id=\"about\"",
      "id=\"comments\"",
      "book-cover",
      "href=\"/about/\"",
      "href=\"/photos/\"",
      "href=\"/leaves/\"",
    ],
    text: ["一册未装订的生活", "UNBOUND EDITION", "生活还没有装订", "最近编页"],
  });
  await checkHtml("/about/", {
    html: ["id=\"main-content\"", "author-portrait", "persona-shelf", "临时占位图"],
    text: ["关于作者", "此刻的我", "人物图版"],
  });
  await checkHtml("/photos/", {
    html: ["id=\"main-content\"", "contact-sheet", "P-001", "P-006"],
    text: ["接触印样", "ROLL 001", "山野、建筑与光"],
  });
  await checkHtml("/leaves/", {
    html: ["id=\"main-content\"", "leaf-stack", "PRIVATE DRAFTS"],
    text: ["未装订散页", "这不是私密草稿目录", "已选散页"],
  });
  await checkHtml("/marginalia/", {
    html: ["id=\"main-content\"", "marginalia-thread", "comments-panel"],
    text: ["页边批注", "全站旁批簿"],
  });
  await checkHtml("/blog/", {
    html: [
      "book-catalog",
      "role=\"search\"",
      ...publishedBlogSources.map((source) => `href="/blog/${source.slug}/"`),
    ],
    text: ["全书目录", "检索本册正文", "全部正文"],
  });

  for (const source of publishedBlogSources) {
    await checkHtml(`/blog/${source.slug}/`, {
      html: [
        "markdown-content",
        "article-reader__rail--archive",
        "article-reader__rail--outline",
        "reader-mobile-tools",
        "<span aria-hidden=\"true\">H1</span>",
        "article-marginalia",
        source.catalogNo,
        `/marginalia/${source.catalogNo.toLowerCase()}/`,
      ],
      text: ["留下你的批注", "页边批注"],
    });

    for (const alias of source.aliases) {
      await checkHtml(`/blog/${alias}/`, {
        html: [
          "http-equiv=\"refresh\"",
          "name=\"robots\" content=\"noindex\"",
          `href=\"https://loadingvibe.com/blog/${source.slug}/\"`,
        ],
      });
    }
  }

  await checkStatus("/blog/README/", 404);
  await checkHtml("/blog/url-name/", {
    html: ["markdown-content"],
    text: ["url", "当我们希望找到函数"],
  });

  const rss = await checkText(
    "/rss.xml",
    publishedBlogSources.map((source) => `/blog/${source.slug}/`),
  );
  if (!/<(?:rss|feed)\b/i.test(rss)) {
    throw new Error("Smoke test failed for /rss.xml: RSS or Atom root element missing");
  }

  await checkText("/robots.txt", ["User-agent:", "Sitemap:"]);
  await checkText("/CNAME", ["loadingvibe.com"]);
  await checkAsset("/assets/brand/you-dian-lai-dian-mark-v1.png");
  await checkAsset("/assets/brand/optimized/mark-192.avif");
  await checkAsset("/assets/about/optimized/roy-profile-960.avif");
  await checkAsset("/assets/brand/optimized/og-unbound-edition-v1.jpg");
  checkPublishedImagePrivacy();

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
    " sitemap file(s)).\n",
);
