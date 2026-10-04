import { createReadStream } from "node:fs";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BLOG_ASSET_PREFIX, blogAssetContentType, getBlogAssetFile, getBlogRoot, listBlogAssets,
} from "../lib/blog-assets.mjs";

export function createBlogAssetMiddleware(rootOption) {
  const root = getBlogRoot(rootOption);
  return async (request, response, next) => {
    let pathname;
    try { pathname = new URL(request.url || "/", "http://localhost").pathname; }
    catch { next(); return; }
    if (!pathname.startsWith(BLOG_ASSET_PREFIX)) { next(); return; }
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" }); response.end(); return;
    }
    const file = getBlogAssetFile(pathname, root);
    if (!file) { response.writeHead(404); response.end("Attachment not found"); return; }
    try {
      const info = await stat(file);
      const headers = {
        "Content-Type": blogAssetContentType(file),
        "Content-Length": info.size,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Accept-Ranges": "bytes",
      };
      let range;
      if (typeof request.headers.range === "string") {
        const match = request.headers.range.match(/^bytes=(\d*)-(\d*)$/u);
        const start = match?.[1] ? Number(match[1]) : Math.max(0, info.size - Number(match?.[2]));
        const end = match?.[1] && match?.[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
        if (!match || (!match[1] && !match[2]) || start > end || start >= info.size) {
          response.writeHead(416, { "Content-Range": `bytes */${info.size}` }); response.end(); return;
        }
        range = { start, end };
        headers["Content-Length"] = end - start + 1;
        headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
      }
      response.writeHead(range ? 206 : 200, headers);
      if (request.method === "HEAD") { response.end(); return; }
      createReadStream(file, range).on("error", () => response.destroy()).pipe(response);
    } catch {
      if (!response.headersSent) response.writeHead(404);
      response.end();
    }
  };
}

/** Keep notebook attachments beside their notes in development and static builds. */
export default function blogAssetsIntegration(options = {}) {
  let root = getBlogRoot(options.root);
  return {
    name: "blog-local-assets",
    hooks: {
      "astro:config:done": ({ config }) => {
        if (!options.root) root = path.join(fileURLToPath(config.root), "Blog");
      },
      "astro:server:setup": ({ server }) => {
        server.watcher.add(root);
        server.middlewares.use(createBlogAssetMiddleware(root));
      },
      "astro:build:done": async ({ dir, logger }) => {
        const output = path.join(fileURLToPath(dir), BLOG_ASSET_PREFIX.slice(1));
        const files = listBlogAssets(root);
        for (const source of files) {
          const destination = path.join(output, path.relative(root, source));
          await mkdir(path.dirname(destination), { recursive: true });
          await copyFile(source, destination);
        }
        if (files.length) logger.info(`Copied ${files.length} local blog attachments.`);
      },
    },
  };
}
