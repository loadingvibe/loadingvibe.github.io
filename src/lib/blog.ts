import { getCollection, type CollectionEntry } from "astro:content";

export type BlogEntry = CollectionEntry<"blog">;

export interface BlogPost {
  entry: BlogEntry;
  routePath: string;
  href: string;
  sourcePath: string;
  directorySegments: string[];
  routeSegments: string[];
  title: string;
  summary: string;
  tags: string[];
  readingMinutes: number;
  date?: Date;
  updated?: Date;
  cover?: string;
}

export interface BlogDirectory {
  key: string;
  label: string;
  depth: number;
  posts: BlogPost[];
}

const pathCollator = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Shanghai",
  year: "numeric",
});

function stripMarkdownExtension(value: string) {
  return value.replace(/\.(?:md|mdx)$/iu, "");
}

function normalizePath(value: string) {
  return value
    .replace(/\\/gu, "/")
    .replace(/^\/+|\/+$/gu, "")
    .replace(/\/{2,}/gu, "/");
}

function sourceId(entry: BlogEntry) {
  if (!entry.filePath) return normalizePath(stripMarkdownExtension(entry.id));

  const filePath = normalizePath(stripMarkdownExtension(entry.filePath));
  const blogMarker = "/Blog/";
  const markerIndex = filePath.lastIndexOf(blogMarker);

  if (markerIndex !== -1) return filePath.slice(markerIndex + blogMarker.length);
  return filePath.startsWith("Blog/") ? filePath.slice("Blog/".length) : filePath;
}

function encodeRoutePath(value: string) {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function fallbackTitle(entry: BlogEntry) {
  const leaf = sourceId(entry).split("/").at(-1) || "未命名文章";
  return leaf.replace(/[-_]+/gu, " ");
}

function plainBody(entry: BlogEntry) {
  return (entry.body || "")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/[#>*_`~\[\]$|()!-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function readingMinutes(entry: BlogEntry) {
  const text = plainBody(entry);
  const chineseCharacters = text.match(/[\u3400-\u9fff]/gu)?.length || 0;
  const latinWords = text.replace(/[\u3400-\u9fff]/gu, " ").match(/[\p{L}\p{N}]+/gu)?.length || 0;
  return Math.max(1, Math.ceil(chineseCharacters / 450 + latinWords / 220));
}

function normalizeCover(value?: string) {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(value)) return value;
  return `/${value.replace(/^\.?(?:\/|\\)+/u, "")}`;
}

export function toBlogPost(entry: BlogEntry): BlogPost {
  const sourcePath = sourceId(entry);
  const routePath = sourcePath;
  const sourceSegments = sourcePath.split("/").filter(Boolean);
  const bodyText = plainBody(entry);

  return {
    entry,
    routePath,
    href: `/blog/${encodeRoutePath(routePath)}/`,
    sourcePath,
    directorySegments: sourceSegments.slice(0, -1),
    routeSegments: routePath.split("/").filter(Boolean),
    title: entry.data.title || fallbackTitle(entry),
    summary: entry.data.summary || bodyText.slice(0, 150) || "一篇尚未添加摘要的 Markdown 文章。",
    tags: entry.data.tags,
    readingMinutes: readingMinutes(entry),
    date: entry.data.date,
    updated: entry.data.updated,
    cover: normalizeCover(entry.data.cover),
  };
}

export async function getPublishedPosts() {
  const entries = await getCollection("blog", ({ data }) => !data.draft);
  const posts = entries.map(toBlogPost).sort((left, right) => {
    const dateDifference = (right.date?.getTime() || 0) - (left.date?.getTime() || 0);
    return dateDifference || pathCollator.compare(left.sourcePath, right.sourcePath);
  });

  const seen = new Map<string, string>();
  for (const post of posts) {
    const existing = seen.get(post.routePath);
    if (existing) {
      throw new Error(
        `Blog route collision: "${existing}" and "${post.sourcePath}" both resolve to /blog/${post.routePath}/`,
      );
    }
    seen.set(post.routePath, post.sourcePath);
  }

  return posts;
}

export function groupPostsByDirectory(posts: BlogPost[]): BlogDirectory[] {
  const groups = new Map<string, BlogPost[]>();

  for (const post of posts) {
    const key = post.directorySegments.join("/");
    const group = groups.get(key) || [];
    group.push(post);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, groupPosts]) => {
      const segments = key.split("/").filter(Boolean);
      return {
        key,
        label: segments.join(" / ") || "写作与随笔",
        depth: 0,
        posts: groupPosts,
      };
    })
    .sort((left, right) => {
      if (!left.key) return -1;
      if (!right.key) return 1;
      return pathCollator.compare(left.key, right.key);
    });
}

export function formatBlogDate(date?: Date) {
  return date ? dateFormatter.format(date).replaceAll("/", " · ") : "日期待补";
}

export function blogCategory(post: BlogPost) {
  return post.directorySegments.length ? post.directorySegments.join(" / ") : "写作与随笔";
}

export function uniqueBlogTags(posts: BlogPost[]) {
  return [...new Set(posts.flatMap((post) => post.tags))].sort(pathCollator.compare);
}
