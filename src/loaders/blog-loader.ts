import { relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Loader, LoaderContext } from "astro/loaders";
import { isBlogSource, readBlogSources } from "../lib/blog-content.mjs";
import { blogAssetContentType } from "../lib/blog-assets.mjs";

/** A source file is its identity; copied frontmatter can never overwrite another note. */
export function blogLoader(): Loader {
  let dispose: (() => void) | undefined;
  return {
    name: "blog-notes-loader",
    async load(context: LoaderContext) {
      dispose?.();
      const root = fileURLToPath(context.config.root);
      const blogRoot = resolve(root, "Blog");
      const reported = new Map<string, string>();
      let initial = true;

      async function sync(changedPath?: string, attachmentChanged = false) {
        const sources = readBlogSources(blogRoot);
        const routesDigest = context.generateDigest({ routes: sources.map((source) => ({
          id: source.id, slug: source.data.slug, draft: source.data.draft,
        })) });
        const untouched = new Set(context.store.keys());
        for (const source of sources) {
          const filePath = resolve(root, source.filePath);
          const data = await context.parseData({ id: source.id, data: source.data, filePath });
          const existing = context.store.get(source.id);
          let rendered = !initial && !attachmentChanged && existing?.body === source.body &&
            existing.rendered?.metadata?.blogRoutesDigest === routesDigest ? existing.rendered : undefined;
          if (!rendered) {
            try {
              // Prevent the renderer's own frontmatter parser from consuming body horizontal rules.
              rendered = await context.renderMarkdown(`<!-- blog body -->\n${source.body}`, { fileURL: pathToFileURL(filePath) });
            } catch (error) {
              const warning = `正文暂时无法完整渲染，已显示原文：${error instanceof Error ? error.message : String(error)}`;
              data.authorWarnings.push(warning);
              const fences = source.body.match(/`+/gu) || [];
              const fence = "`".repeat(Math.max(3, ...fences.map((run) => run.length + 1)));
              rendered = await context.renderMarkdown(`${fence}text\n${source.body}\n${fence}`, { fileURL: pathToFileURL(filePath) });
            }
          }
          rendered.metadata = { ...rendered.metadata, blogRoutesDigest: routesDigest };
          // A metadata-only save must update the store too. Astro skips equal digests.
          const digest = context.generateDigest({ body: source.body, data, rendered });
          context.store.set({
            id: source.id, data, body: source.body, filePath: source.filePath,
            digest, rendered, assetImports: rendered.metadata?.imagePaths,
          });
          const warningText = data.authorWarnings.join("\n");
          if (warningText && warningText !== reported.get(source.id)) context.logger.warn(`${source.filePath}: ${warningText}`);
          reported.set(source.id, warningText);
          untouched.delete(source.id);
        }
        for (const id of untouched) { context.store.delete(id); reported.delete(id); }
        initial = false;
        if (changedPath && context.watcher) {
          context.logger.info(`已更新 ${relative(root, changedPath)}`);
          context.watcher.emit("blog:updated", { filePath: changedPath });
        }
      }

      await sync();
      const watcher = context.watcher;
      if (!watcher) return;
      watcher.add(blogRoot);
      let timer: ReturnType<typeof setTimeout> | undefined;
      let queue = Promise.resolve();
      let pendingAttachmentChanged = false;
      const onChange = (filePath: string) => {
        const sourcePath = relative(blogRoot, filePath).replaceAll("\\", "/");
        if (sourcePath.startsWith("../")) return;
        const sourceChanged = isBlogSource(sourcePath);
        const attachmentChanged = Boolean(blogAssetContentType(filePath)) &&
          !sourcePath.split("/").some((part) => /^[_.]/u.test(part));
        if (!sourceChanged && !attachmentChanged) return;
        pendingAttachmentChanged ||= attachmentChanged;
        clearTimeout(timer);
        timer = setTimeout(() => {
          const rerenderAttachments = pendingAttachmentChanged;
          pendingAttachmentChanged = false;
          queue = queue.then(() => sync(filePath, rerenderAttachments)).catch((error) => {
            context.logger.error(`更新笔记失败：${error instanceof Error ? error.message : String(error)}`);
          });
        }, 80);
      };
      watcher.on("add", onChange);
      watcher.on("change", onChange);
      watcher.on("unlink", onChange);
      dispose = () => {
        clearTimeout(timer);
        watcher.off("add", onChange);
        watcher.off("change", onChange);
        watcher.off("unlink", onChange);
      };
    },
  };
}
