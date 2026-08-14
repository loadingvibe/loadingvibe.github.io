import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const buildRoot = resolve(projectRoot, "dist");
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
for (const marker of ["writing-guide", "gradient-descent"]) {
  if (!sitemapXml.includes(marker)) {
    throw new Error("Sitemap is missing the published route marker: " + marker);
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

try {
  await checkHtml("/", {
    html: ["有点来电｜Roy 的生活与学习记录"],
    text: ["有点来电"],
  });
  await checkHtml("/blog/", {
    text: ["从梯度下降开始"],
  });
  await checkHtml("/blog/writing-guide/", {
    html: ["markdown-content"],
    text: ["如何在这里写博客", "这个网站会自动读取"],
  });
  await checkHtml("/blog/技术与学习/数学/gradient-descent/", {
    html: ["markdown-content"],
    text: ["从梯度下降开始", "当我们希望找到函数"],
  });

  const rss = await checkText("/rss.xml", ["从梯度下降开始"]);
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
