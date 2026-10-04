import path from "node:path";
import { fileURLToPath } from "node:url";
import { slug as headingSlug } from "github-slugger";
import rehypeRaw from "rehype-raw";
import { BLOG_EXTENSIONS, encodeBlogRoute, readBlogSources } from "./blog-content.mjs";

function blogRoot(options) {
  return path.resolve(options.root instanceof URL ? fileURLToPath(options.root) : options.root || path.join(process.cwd(), "Blog"));
}

function withinRoot(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function key(value) { return value.replaceAll("\\", "/").normalize("NFC"); }

function context(sourceFile, options) {
  const root = blogRoot(options);
  let source;
  try { source = sourceFile instanceof URL ? fileURLToPath(sourceFile) : path.resolve(sourceFile); }
  catch { return undefined; }
  if (!withinRoot(root, source)) return undefined;
  let entries;
  // A file can disappear during a rename/save. Keep existing links while the
  // next authoring refresh rebuilds the source index rather than aborting HTML.
  try { entries = readBlogSources(root); } catch { return undefined; }
  const byPath = new Map();
  for (const entry of entries) {
    const sourcePath = key(entry.id);
    const matches = byPath.get(sourcePath) || [];
    matches.push(entry);
    byPath.set(sourcePath, matches);
  }
  return { root, source, entries, byPath, includeDrafts: options.includeDrafts ?? process.env.NODE_ENV !== "production" };
}

function exactEntries(target, ctx, withoutExtension) {
  if (!withinRoot(ctx.root, target)) return [];
  const relative = key(path.relative(ctx.root, target));
  if (!withoutExtension) return ctx.byPath.get(relative) || [];
  return ctx.entries.filter((entry) => key(entry.id).replace(/\.(?:md|markdown|txt)$/iu, "") === relative);
}

function wikiEntries(input, ctx, withoutExtension) {
  // An unqualified wiki name is safe only when it names exactly one note in
  // the vault. Authors can disambiguate with ./name or a directory path.
  if (!input.includes("/")) {
    return ctx.entries.filter((entry) => {
      const filename = path.posix.basename(key(entry.id));
      return (withoutExtension ? filename.replace(/\.(?:md|markdown|txt)$/iu, "") : filename) === input.normalize("NFC");
    });
  }
  const local = exactEntries(path.resolve(path.dirname(ctx.source), input), ctx, withoutExtension);
  if (/^\.{1,2}\//u.test(input)) return local;
  const vault = exactEntries(path.resolve(ctx.root, input), ctx, withoutExtension);
  return [...new Set([...local, ...vault])];
}

function wikiSuffix(suffix) {
  const hash = suffix.indexOf("#");
  if (hash < 0) return suffix;
  let heading = suffix.slice(hash + 1);
  try { heading = decodeURIComponent(heading); } catch { return suffix; }
  return suffix.slice(0, hash) + "#" + encodeURIComponent(headingSlug(heading));
}

function resolveLink(value, ctx, wiki = false) {
  if (!ctx || typeof value !== "string" || !value.trim()) return value;
  let input = value.trim().replaceAll("\\", "/");
  // Absolute website links, protocols and remote URLs retain their meaning.
  if (input.startsWith("/") || /^[a-z][a-z\d+.-]*:/iu.test(input)) return value;
  if (input.startsWith("#") && !wiki) return value;
  const suffixIndex = input.search(/[?#]/u);
  const suffix = suffixIndex < 0 ? "" : input.slice(suffixIndex);
  input = suffixIndex < 0 ? input : input.slice(0, suffixIndex);
  try { input = decodeURIComponent(input); } catch { return value; }
  if (input.includes("\0") || input.startsWith("/")) return value;
  const extension = path.posix.extname(input).toLowerCase();
  const withoutExtension = !extension;
  if ((!wiki && !BLOG_EXTENSIONS.has(extension)) || (extension && !BLOG_EXTENSIONS.has(extension))) return value;

  const candidates = wiki
    ? input ? wikiEntries(input, ctx, withoutExtension) : exactEntries(ctx.source, ctx, false)
    : exactEntries(path.resolve(path.dirname(ctx.source), input), ctx, false);
  const unique = [...new Set(candidates)];
  if (unique.length !== 1 || (unique[0].data.draft && !ctx.includeDrafts)) return value;
  return `/blog/${encodeBlogRoute(unique[0].data.slug)}/` + (wiki ? wikiSuffix(suffix) : suffix);
}

/** Resolve relative Markdown links using the target note's final public slug. */
export function resolveBlogLinkUrl(value, sourceFile, options = {}) {
  return resolveLink(value, context(sourceFile, options), options.wiki === true);
}

function walk(node, visitor) {
  visitor(node);
  if (node.children) for (const child of node.children) walk(child, visitor);
}

function expandWikiLinks(parent, ctx) {
  if (!parent.children || ["link", "linkReference", "image", "imageReference", "code", "inlineCode", "html"].includes(parent.type)) return;
  const children = [];
  for (const child of parent.children) {
    if (child.type !== "text") {
      expandWikiLinks(child, ctx);
      children.push(child);
      continue;
    }
    let offset = 0;
    for (const match of child.value.matchAll(/(?<!!)\[\[([^\]\n]+)\]\]/gu)) {
      const divider = match[1].indexOf("|");
      const destination = (divider < 0 ? match[1] : match[1].slice(0, divider)).trim();
      const label = divider < 0 ? destination : match[1].slice(divider + 1).trim() || destination;
      const url = resolveLink(destination, ctx, true);
      if (url === destination) continue;
      if (match.index > offset) children.push({ type: "text", value: child.value.slice(offset, match.index) });
      children.push({ type: "link", url, children: [{ type: "text", value: label }] });
      offset = match.index + match[0].length;
    }
    if (offset < child.value.length) children.push({ ...child, value: child.value.slice(offset) });
  }
  parent.children = children;
}

export function remarkBlogLinks(options = {}) {
  return (tree, file) => {
    if (!file.path) return;
    const ctx = context(file.path, options);
    if (!ctx) return;
    expandWikiLinks(tree, ctx);
    walk(tree, (node) => {
      if (["link", "definition"].includes(node.type) && typeof node.url === "string") {
        node.url = resolveLink(node.url, ctx);
      }
    });
  };
}

/** Resolve links in pasted HTML as well as the anchors generated by Markdown. */
export function rehypeBlogLinks(options = {}) {
  const parseRaw = rehypeRaw();
  return (tree, file) => {
    if (!file.path) return;
    const ctx = context(file.path, options);
    if (!ctx) return;
    const parsed = parseRaw(tree, file);
    walk(parsed, (node) => {
      if (node.type === "element" && node.tagName === "a" && typeof node.properties?.href === "string") {
        node.properties.href = resolveLink(node.properties.href, ctx);
      }
    });
    return parsed;
  };
}
