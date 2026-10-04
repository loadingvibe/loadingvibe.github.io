import path from "node:path";
import { fileURLToPath } from "node:url";
import { isBlogDirectoryName } from "../lib/blog-directories.mjs";

const CONTENT_DATA_ID = "\0astro:data-layer-content";
const CONTENT_CHUNK_ID_PREFIX = `${CONTENT_DATA_ID}-chunk:`;

/**
 * Astro's persisted content data is the preview barrier: loader completion alone
 * is too early because its store writes are debounced. Refresh every server
 * environment before Astro's own data-store listener reloads the browser.
 *
 * @param {import("vite").ViteDevServer} server
 * @param {{ root: URL; logger?: { info(message: string): void }; debounceMs?: number }} options
 */
export function attachBlogPreview(server, { root, logger, debounceMs = 120 }) {
  const rootPath = fileURLToPath(root);
  const blogPath = path.join(rootPath, "Blog");
  const dataStorePath = path.join(rootPath, ".astro", "data-store.json");
  const dataStoreManifestPath = path.join(rootPath, ".astro", "data-store", "manifest.json");
  const assetImportsPath = path.join(rootPath, ".astro", "content-assets.mjs");
  let contentUpdatePending = false;
  let attachmentTimer;

  const isBlogAttachment = (filePath) => {
    const relative = path.relative(blogPath, path.resolve(filePath));
    return relative && !relative.startsWith(`..${path.sep}`) && relative !== ".."
      && !path.isAbsolute(relative)
      && (relative.split(path.sep).some((segment) => /\.assets$/iu.test(segment))
        || !/\.(?:md|markdown|mdown|mkdn|mkd|mdwn|txt)$/iu.test(relative));
  };

  const invalidateContent = () => {
    const timestamp = Date.now();
    for (const [name, environment] of Object.entries(server.environments)) {
      if (name === "client") continue;

      const invalidated = new Set();
      for (const [id, module] of environment.moduleGraph.idToModuleMap) {
        if (id === CONTENT_DATA_ID || id.startsWith(CONTENT_CHUNK_ID_PREFIX)
          || module.file === assetImportsPath) {
          environment.moduleGraph.invalidateModule(module, invalidated, timestamp, true);
        }
      }

      // Vite's runner also caches evaluated exports, including getCollection's
      // store singleton and getStaticPaths props. Invalidate importers together.
      if ("runner" in environment) {
        for (const module of invalidated) {
          const evaluated = environment.runner.evaluatedModules.getModuleById(module.id);
          if (evaluated) environment.runner.evaluatedModules.invalidateModule(evaluated);
        }
      }
      environment.hot.send("astro:content-changed", {});
    }
  };

  const onContentStore = (filePath) => {
    const absolute = path.resolve(filePath);
    if (absolute !== dataStorePath && absolute !== dataStoreManifestPath) return;
    invalidateContent();
    if (contentUpdatePending) {
      contentUpdatePending = false;
      logger?.info("博客已同步，浏览器预览自动更新。");
    }
    // Astro now sends its native full-reload event. Keeping that single event
    // avoids another browser refresh while guaranteeing fresh routes and props.
  };

  const onBlogUpdated = () => { contentUpdatePending = true; };
  const onAttachment = (filePath) => {
    if (!isBlogAttachment(filePath)) return;
    clearTimeout(attachmentTimer);
    attachmentTimer = setTimeout(() => {
      attachmentTimer = undefined;
      server.environments.client.hot.send({ type: "full-reload", path: "*" });
    }, debounceMs);
  };
  const onDirectory = (filePath) => {
    const relative = path.relative(blogPath, path.resolve(filePath));
    // Empty top-level folders have no content-store mutation to trigger Astro's reload.
    if (relative.includes(path.sep) || !isBlogDirectoryName(relative)) return;
    invalidateContent();
    clearTimeout(attachmentTimer);
    attachmentTimer = setTimeout(() => {
      attachmentTimer = undefined;
      server.environments.client.hot.send({ type: "full-reload", path: "*" });
    }, debounceMs);
  };

  server.watcher.add(blogPath);
  server.watcher.on("blog:updated", onBlogUpdated);
  // Prepending is intentional: Astro's native listener sends the browser reload
  // during this same event, so all environment caches must be ready first.
  server.watcher.prependListener("add", onContentStore);
  server.watcher.prependListener("change", onContentStore);
  for (const event of ["add", "change", "unlink"]) server.watcher.on(event, onAttachment);
  for (const event of ["addDir", "unlinkDir"]) server.watcher.on(event, onDirectory);

  const dispose = () => {
    clearTimeout(attachmentTimer);
    server.watcher.off("blog:updated", onBlogUpdated);
    server.watcher.off("add", onContentStore);
    server.watcher.off("change", onContentStore);
    for (const event of ["add", "change", "unlink"]) server.watcher.off(event, onAttachment);
    for (const event of ["addDir", "unlinkDir"]) server.watcher.off(event, onDirectory);
    server.httpServer?.off("close", dispose);
  };
  server.httpServer?.once("close", dispose);
  return dispose;
}

/** @returns {import("astro").AstroIntegration} */
export default function blogPreview() {
  let root;
  return {
    name: "blog-preview",
    hooks: {
      "astro:config:setup": ({ config }) => { root = config.root; },
      "astro:server:setup": ({ server, logger }) => { attachBlogPreview(server, { root, logger }); },
    },
  };
}
