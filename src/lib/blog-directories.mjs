import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export const BLOG_ROOT = resolve(process.cwd(), "Blog");
const folderOrder = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

export function isBlogDirectoryName(name) {
  return Boolean(name) && !/^[_.]|\.assets$/iu.test(name);
}

/** Include empty folders: the filesystem, rather than article metadata, defines the catalog. */
export function listBlogDirectories(root = BLOG_ROOT) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isBlogDirectoryName(entry.name))
    .map((entry) => entry.name)
    .sort(folderOrder.compare);
}

export function blogDirectoryIcon(name) {
  if (name.includes("知识库")) return "book";
  if (name === "朋友圈") return "people";
  return "folder";
}
