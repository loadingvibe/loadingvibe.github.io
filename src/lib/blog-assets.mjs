import { existsSync, lstatSync, readdirSync, realpathSync, statSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { imageMetadata } from "astro/assets/utils";
import rehypeRaw from "rehype-raw";
import { isBlogSource } from "./blog-content.mjs";

export const BLOG_ASSET_PREFIX = "/blog-assets/";

const assetTypes = new Map(Object.entries({
  ".avif": "image/avif", ".bmp": "image/bmp", ".gif": "image/gif",
  ".heic": "image/heic", ".ico": "image/x-icon", ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml",
  ".tif": "image/tiff", ".tiff": "image/tiff", ".webp": "image/webp",
  ".aac": "audio/aac", ".flac": "audio/flac", ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg", ".oga": "audio/ogg", ".ogg": "audio/ogg",
  ".opus": "audio/ogg", ".wav": "audio/wav",
  ".m4v": "video/mp4", ".mov": "video/quicktime", ".mp4": "video/mp4",
  ".ogv": "video/ogg", ".webm": "video/webm",
  ".pdf": "application/pdf", ".csv": "text/csv", ".tsv": "text/tab-separated-values",
  ".json": "application/json", ".txt": "text/plain",
  ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".zip": "application/zip", ".7z": "application/x-7z-compressed", ".rar": "application/vnd.rar",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
}));

export function getBlogRoot(root) {
  return path.resolve(root instanceof URL ? fileURLToPath(root) : root || path.join(process.cwd(), "Blog"));
}

function withinRoot(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function visiblePath(root, target) {
  return withinRoot(root, target) && !path.relative(root, target).split(path.sep).some((part) => /^[._]/u.test(part));
}

function decodePath(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function blogAssetContentType(file) {
  return assetTypes.get(path.extname(file).toLowerCase());
}

// Check real paths as well as lexical paths. A symlink in a notes folder must
// never make private files elsewhere on the computer available on the website.
function safeAssetPath(root, target, allowMissing = false) {
  if (!visiblePath(root, target) || !blogAssetContentType(target)) return false;
  const sourceRelative = path.relative(root, target);
  if (isBlogSource(sourceRelative)) return false;
  // Text notes belong to the article loader. Only text explicitly stored in an
  // exported attachment folder is downloadable through the asset endpoint.
  if (path.extname(target).toLowerCase() === ".txt" &&
      !sourceRelative.split(path.sep).slice(0, -1).some((segment) => /\.assets$/iu.test(segment))) return false;
  try {
    let component = root;
    for (const segment of path.relative(root, target).split(path.sep)) {
      component = path.join(component, segment);
      if (existsSync(component) && lstatSync(component).isSymbolicLink()) return false;
    }
    const actualRoot = realpathSync(root);
    if (existsSync(target)) {
      return statSync(target).isFile() && withinRoot(actualRoot, realpathSync(target));
    }
    if (!allowMissing) return false;
    let parent = path.dirname(target);
    while (!existsSync(parent) && withinRoot(root, parent)) parent = path.dirname(parent);
    const actualParent = realpathSync(parent);
    return actualParent === actualRoot || withinRoot(actualRoot, actualParent);
  } catch {
    return false;
  }
}

export function listBlogAssets(rootOption) {
  const root = getBlogRoot(rootOption);
  const files = [];
  function walk(directory) {
    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (/^[._]/u.test(entry.name)) continue;
      const file = path.join(directory, entry.name);
      // Do not traverse symlinked directories or include symlinked files.
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && safeAssetPath(root, file)) files.push(file);
    }
  }
  walk(root);
  return files.sort();
}

function encodeAssetPath(root, target) {
  return BLOG_ASSET_PREFIX + path.relative(root, target).split(path.sep).map(encodeURIComponent).join("/");
}

/** Resolve an article-relative or Obsidian vault-relative attachment URL. */
export function resolveBlogAssetUrl(value, sourceFile, options = {}) {
  if (typeof value !== "string" || !value.trim()) return value;
  const original = value;
  let input = value.trim().replace(/\\/gu, "/");
  if (input.startsWith(BLOG_ASSET_PREFIX) || input.startsWith("//") || input.startsWith("#")) return original;
  const root = getBlogRoot(options.root);
  if (/^file:/iu.test(input)) {
    try {
      const file = fileURLToPath(new URL(input));
      return safeAssetPath(root, file) ? encodeAssetPath(root, file) : original;
    } catch { return original; }
  }
  if (/^[a-z][a-z\d+.-]*:/iu.test(input)) return original;
  const suffixIndex = input.search(/[?#]/u);
  const suffix = suffixIndex < 0 ? "" : input.slice(suffixIndex);
  input = decodePath(suffixIndex < 0 ? input : input.slice(0, suffixIndex));
  if (!input || input.includes("\0")) return original;
  let source;
  try { source = sourceFile instanceof URL ? fileURLToPath(sourceFile) : path.resolve(sourceFile || path.join(root, "note.md")); }
  catch { return original; }
  if (!withinRoot(root, source)) return original;
  const rootRelative = input.replace(/^\/?Blog\//iu, "").replace(/^\/+/, "");
  const local = path.resolve(path.dirname(source), input);
  const vault = path.resolve(root, rootRelative);
  const candidates = input.startsWith("/") || /^Blog\//iu.test(input) ? [vault] : [local, vault];
  let target = candidates.find((candidate) => safeAssetPath(root, candidate));
  // Obsidian commonly omits the attachment directory in ![[image.png]]. Only
  // resolve an unambiguous basename; never silently choose between two images.
  if (!target && !input.includes("/")) {
    const matches = listBlogAssets(root).filter((file) => path.basename(file) === input);
    if (matches.length === 1) target = matches[0];
  }
  if (!target && options.allowMissing && !input.startsWith("/")) {
    target = candidates.find((candidate) => safeAssetPath(root, candidate, true));
  }
  return target ? encodeAssetPath(root, target) + suffix : original;
}

/** Resolve a public asset request, refusing traversal, hidden files and notes. */
export function getBlogAssetFile(pathname, rootOption) {
  if (!pathname.startsWith(BLOG_ASSET_PREFIX)) return undefined;
  const root = getBlogRoot(rootOption);
  const relative = decodePath(pathname.slice(BLOG_ASSET_PREFIX.length)).replace(/\\/gu, "/");
  if (!relative || relative.includes("\0")) return undefined;
  const target = path.resolve(root, relative);
  return safeAssetPath(root, target) ? target : undefined;
}

function walkTree(node, visitor) {
  visitor(node);
  if (node.children) for (const child of node.children) walkTree(child, visitor);
}

function embedNode(destination, alias, file, options) {
  const url = resolveBlogAssetUrl(destination, file, { ...options, allowMissing: true });
  if (url === destination || !url.startsWith(BLOG_ASSET_PREFIX)) return undefined;
  const type = blogAssetContentType(decodePath(destination.split(/[?#]/u)[0]));
  const label = alias || path.basename(destination.replace(/\\/gu, "/"));
  if (type?.startsWith("image/")) {
    const size = alias?.match(/^(\d+)(?:x(\d+))?$/iu);
    return {
      type: "image", url, alt: size ? path.basename(destination) : label,
      ...(size ? { data: { hProperties: { width: Number(size[1]), ...(size[2] ? { height: Number(size[2]) } : {}) } } } : {}),
    };
  }
  if (type?.startsWith("audio/") || type?.startsWith("video/")) {
    const tag = type.startsWith("audio/") ? "audio" : "video";
    const safeUrl = url.replace(/&/gu, "&amp;").replace(/"/gu, "&quot;");
    return { type: "html", value: `<${tag} controls preload="metadata" src="${safeUrl}"></${tag}>` };
  }
  return { type: "link", url, children: [{ type: "text", value: label }] };
}

function expandEmbeds(parent, file, options) {
  if (!parent.children) return;
  const children = [];
  for (const child of parent.children) {
    if (child.type !== "text") {
      expandEmbeds(child, file, options);
      children.push(child);
      continue;
    }
    // Also accept a common pasted image syntax with unescaped spaces. Standard
    // Markdown images and reference definitions are handled by the AST below.
    const pattern = /!\[\[([^\]\n]+)\]\]|!\[([^\]\n]*)\]\(([^\n)]+)\)/gu;
    let offset = 0;
    for (const match of child.value.matchAll(pattern)) {
      let destination;
      let alias;
      if (match[1]) [destination, alias] = match[1].split("|", 2);
      else { destination = match[3].trim(); alias = match[2]; }
      const node = embedNode(destination.trim(), alias?.trim(), file, options);
      if (!node) continue;
      if (match.index > offset) children.push({ type: "text", value: child.value.slice(offset, match.index) });
      children.push(node);
      offset = match.index + match[0].length;
    }
    if (offset < child.value.length) children.push({ ...child, value: child.value.slice(offset) });
  }
  parent.children = children;
}

/** Run before Astro collects local images so missing attachments cannot abort rendering. */
export function remarkBlogAssets(options = {}) {
  return (tree, file) => {
    if (!file.path) return;
    expandEmbeds(tree, file.path, options);
    const imageDefinitions = new Set();
    walkTree(tree, (node) => {
      if (node.type === "imageReference") imageDefinitions.add(node.identifier);
    });
    walkTree(tree, (node) => {
      if (["image", "link", "definition"].includes(node.type) && typeof node.url === "string") {
        node.url = resolveBlogAssetUrl(node.url, file.path, { ...options, allowMissing: node.type !== "link" });
        const isImage = node.type === "image" || (node.type === "definition" && imageDefinitions.has(node.identifier));
        if (isImage) {
          // Unsupported or out-of-vault image paths should remain broken images,
          // rather than becoming Astro imports that stop the whole note rendering.
          if (!/^(?:[a-z][a-z\d+.-]*:|\/|#)/iu.test(node.url)) {
            node.url = `${BLOG_ASSET_PREFIX}_unavailable/${encodeURIComponent(path.basename(node.url.replace(/\\/gu, "/")))}`;
          }
          // Astro's image collector decodes every image URL, including public and
          // remote URLs. Treat a literal or half-written percent escape as text.
          try { decodeURI(node.url); } catch { node.url = node.url.replace(/%/gu, "%25"); }
        }
      }
    });
  };
}

/** Parse pasted HTML and resolve image/video/audio/source and download attributes. */
export function rehypeBlogAssets(options = {}) {
  const parseRaw = rehypeRaw();
  const dimensionsCache = new Map();
  async function supplyImageDimensions(node) {
    if (node.tagName !== "img" || typeof node.properties.src !== "string") return;
    const source = getBlogAssetFile(node.properties.src.split(/[?#]/u)[0], options.root);
    if (!source) return;
    try {
      const info = await stat(source);
      const fingerprint = `${info.mtimeMs}:${info.size}`;
      let cached = dimensionsCache.get(source);
      if (cached?.fingerprint !== fingerprint) {
        cached = { fingerprint, metadata: readFile(source).then((bytes) => imageMetadata(bytes, source)) };
        dimensionsCache.set(source, cached);
      }
      const metadata = await cached.metadata;
      const givenWidth = Number(node.properties.width);
      const givenHeight = Number(node.properties.height);
      const width = givenWidth > 0 ? givenWidth : givenHeight > 0 ? Math.round(givenHeight * metadata.width / metadata.height) : metadata.width;
      const height = givenWidth > 0 ? Math.round(givenWidth * metadata.height / metadata.width) : givenHeight > 0 ? givenHeight : metadata.height;
      node.properties.width = Math.max(1, width);
      node.properties.height = Math.max(1, height);
      node.properties.loading ??= "lazy";
      node.properties.decoding ??= "async";
    } catch {
      // An image being written, missing or damaged must not hide the note body.
    }
  }
  return async (tree, file) => {
    const parsed = parseRaw(tree, file);
    if (!file.path) return parsed;
    const images = [];
    walkTree(parsed, (node) => {
      if (node.type !== "element" || !node.properties) return;
      for (const attribute of ["src", "poster", "href"]) {
        if (typeof node.properties[attribute] === "string") {
          node.properties[attribute] = resolveBlogAssetUrl(node.properties[attribute], file.path, {
            ...options, allowMissing: attribute !== "href",
          });
        }
      }
      if (typeof node.properties.srcSet === "string" && !node.properties.srcSet.includes("data:")) {
        node.properties.srcSet = node.properties.srcSet.split(",").map((candidate) => {
          const match = candidate.trim().match(/^(.*?)(\s+\d+(?:\.\d+)?[wx])?$/u);
          return resolveBlogAssetUrl(match[1], file.path, { ...options, allowMissing: true }) + (match[2] || "");
        }).join(", ");
      }
      if (node.tagName === "img") images.push(node);
    });
    await Promise.all(images.map(supplyImageDimensions));
    return parsed;
  };
}
