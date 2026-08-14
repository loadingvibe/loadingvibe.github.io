import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const buildRoot = resolve(projectRoot, "dist");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

if (!existsSync(buildRoot) || !statSync(buildRoot).isDirectory()) {
  throw new Error("Missing dist/. Run npm run build first.");
}

const server = createServer((request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathname = decodeURIComponent(requestUrl.pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = resolve(buildRoot, relativePath);
    const pathFromRoot = relative(buildRoot, filePath);

    if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
      response.writeHead(403).end();
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404).end();
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
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

const baseUrl = `http://127.0.0.1:${address.port}`;
const checks = [
  { path: "/", contains: "有点来电｜Roy 的生活与笔记" },
  { path: "/CNAME", contains: "loadingvibe.com" },
  { path: "/assets/brand/you-dian-lai-dian-mark-v1.png" },
];

const builtAssets = readdirSync(resolve(buildRoot, "assets"));
if (!builtAssets.some((filename) => filename.endsWith(".js"))) {
  throw new Error("Static build is missing the compiled JavaScript bundle.");
}
if (!builtAssets.some((filename) => filename.endsWith(".css"))) {
  throw new Error("Static build is missing the compiled CSS bundle.");
}

const indexHtml = readFileSync(resolve(buildRoot, "index.html"), "utf8");
if (indexHtml.includes("chatgpt.site") || indexHtml.includes("http-equiv=\"refresh\"")) {
  throw new Error("Static build must host the site directly, not redirect elsewhere.");
}

try {
  for (const check of checks) {
    const response = await fetch(`${baseUrl}${check.path}`);
    if (!response.ok) {
      throw new Error(`Smoke test failed for ${check.path}: HTTP ${response.status}`);
    }

    if (check.contains) {
      const body = await response.text();
      if (!body.includes(check.contains)) {
        throw new Error(`Smoke test failed for ${check.path}: content marker missing`);
      }
    } else {
      await response.arrayBuffer();
    }
  }
} finally {
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

process.stdout.write(`Static build smoke test passed (${checks.length} routes).\n`);
