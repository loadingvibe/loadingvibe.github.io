import { parse as parseYaml } from "yaml";

const markdownFiles = import.meta.glob("/Blog/**/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
});

function cleanSegment(value) {
  return value.replace(/\.md$/i, "").replace(/^\d+[-_. ]*/, "").replace(/[-_]+/g, " ").trim();
}

function pathToHref(path) {
  return `/blog/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function parseFrontmatter(source) {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return { data: {}, content: source };
  try {
    return { data: parseYaml(match[1]) || {}, content: source.slice(match[0].length) };
  } catch {
    return { data: {}, content: source.slice(match[0].length) };
  }
}

function toArticle(filePath, source) {
  const relativePath = filePath.replace(/^\/Blog\//, "").replace(/\.md$/i, "");
  const { data, content } = parseFrontmatter(source);
  const segments = relativePath.split("/");
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = String(data.title || heading || cleanSegment(segments.at(-1)));
  const plain = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\[\]$|]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const date = data.date ? new Date(data.date) : null;
  const dateValue = date && !Number.isNaN(date.valueOf()) ? date.valueOf() : 0;

  return {
    path: relativePath,
    href: pathToHref(relativePath),
    segments,
    directories: segments.slice(0, -1),
    title,
    summary: String(data.summary || data.description || plain.slice(0, 150)),
    date: dateValue ? new Date(dateValue).toISOString().slice(0, 10) : "",
    dateValue,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    draft: data.draft === true,
    content: content.replace(/^#\s+.+\n+/, ""),
    readingMinutes: Math.max(1, Math.ceil(plain.length / 500)),
  };
}

export function getBlogArticles() {
  return Object.entries(markdownFiles)
    .map(([path, source]) => toArticle(path, source))
    .filter((article) => !article.draft)
    .sort((a, b) => b.dateValue - a.dateValue || a.title.localeCompare(b.title, "zh-CN"));
}

export function getBlogArticle(slug) {
  const wanted = slug.map((segment) => decodeURIComponent(segment)).join("/");
  return getBlogArticles().find((article) => article.path === wanted) || null;
}

export function getBlogTree(articles = getBlogArticles()) {
  const root = { name: "Blog", path: "", folders: new Map(), articles: [] };
  for (const article of articles) {
    let node = root;
    for (const directory of article.directories) {
      if (!node.folders.has(directory)) {
        const path = [node.path, directory].filter(Boolean).join("/");
        node.folders.set(directory, { name: cleanSegment(directory), path, folders: new Map(), articles: [] });
      }
      node = node.folders.get(directory);
    }
    node.articles.push(article);
  }
  return root;
}

export { cleanSegment, pathToHref };
