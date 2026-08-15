import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
      const draftMatch = frontmatter.match(/^draft:[\t ]*(true|false)[\t ]*$/imu);

      return {
        sourcePath,
        slug,
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

for (const removedRoute of ["/blog/README/", "/blog/ai/url-name/"]) {
  if (sitemapXml.includes(removedRoute)) {
    throw new Error(`Sitemap still contains removed internal or duplicate content: ${removedRoute}`);
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
      "有点来电｜Roy 的生活与学习记录",
      "id=\"archive\"",
      "id=\"comments\"",
      "class=\"archive-explorer\"",
      "role=\"search\"",
      "type=\"search\"",
    ],
    text: ["有点来电", "文章档案", "滑动，读取我的记录", "回声"],
  });
  await checkHtml("/blog/", {
    html: [
      "class=\"archive-explorer\"",
      "role=\"search\"",
      ...publishedBlogSources.map((source) => `href="/blog/${source.slug}/"`),
    ],
    text: ["搜索一条信号", "全部文章"],
  });

  for (const source of publishedBlogSources) {
    await checkHtml(`/blog/${source.slug}/`, {
      html: [
        "markdown-content",
        "article-reader__rail--archive",
        "article-reader__rail--outline",
        "reader-mobile-tools",
        "<span aria-hidden=\"true\">H1</span>",
      ],
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
  await checkStatus("/blog/ai/url-name/", 404);

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
  await checkAsset("/og-you-dian-lai-dian-v1.png");

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
