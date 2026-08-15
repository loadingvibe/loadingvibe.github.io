import { getCollection, type CollectionEntry } from "astro:content";

export type BlogEntry = CollectionEntry<"blog">;
export type BlogCategory = BlogEntry["data"]["category"];

export const BLOG_CATEGORIES: readonly BlogCategory[] = ["生活", "工作", "笔记", "收藏"];
export const BLOG_GITHUB_REPOSITORY_URL = "https://github.com/loadingvibe/loadingvibe.github.io";
export const BLOG_GITHUB_BRANCH = "main";

export interface BlogPost {
  entry: BlogEntry;
  slug: string;
  routePath: string;
  href: string;
  aliases: string[];
  sourcePath: string;
  sourceFilePath: string;
  githubManageUrl: string;
  githubDeleteUrl: string;
  directorySegments: string[];
  routeSegments: string[];
  title: string;
  catalogNo: string;
  summary: string;
  category: BlogCategory;
  tags: string[];
  featured: boolean;
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

function githubFileUrl(action: "blob" | "delete", sourceFilePath: string) {
  const encodedBranch = encodeURIComponent(BLOG_GITHUB_BRANCH);
  const encodedSourcePath = encodeRoutePath(sourceFilePath);
  return `${BLOG_GITHUB_REPOSITORY_URL}/${action}/${encodedBranch}/${encodedSourcePath}`;
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
  const sourceFilePath = `Blog/${sourcePath}.md`;
  const routePath = entry.data.slug;
  const sourceSegments = sourcePath.split("/").filter(Boolean);

  return {
    entry,
    slug: entry.data.slug,
    routePath,
    href: `/blog/${encodeRoutePath(routePath)}/`,
    aliases: entry.data.aliases,
    sourcePath,
    sourceFilePath,
    githubManageUrl: githubFileUrl("blob", sourceFilePath),
    githubDeleteUrl: githubFileUrl("delete", sourceFilePath),
    directorySegments: sourceSegments.slice(0, -1),
    routeSegments: routePath.split("/").filter(Boolean),
    title: entry.data.title,
    catalogNo: entry.data.catalogNo,
    summary: entry.data.summary,
    category: entry.data.category,
    tags: entry.data.tags,
    featured: entry.data.featured,
    readingMinutes: readingMinutes(entry),
    date: entry.data.date,
    updated: entry.data.updated,
    cover: normalizeCover(entry.data.cover),
  };
}

export async function getPublishedPosts() {
  const entries = await getCollection("blog");
  // One Markdown file is always one content entry. Body text is deliberately never hashed or deduplicated:
  // two files with identical prose remain two posts as long as their public URL claims are distinct.
  const allPosts = entries.map(toBlogPost);

  const seen = new Map<string, { claim: "slug" | "alias"; sourceFilePath: string }>();
  const seenCatalogNumbers = new Map<string, string>();
  for (const post of allPosts) {
    const existingCatalogSource = seenCatalogNumbers.get(post.catalogNo);
    if (existingCatalogSource) {
      throw new Error(
        `Blog catalog collision: "${existingCatalogSource}" and "${post.sourceFilePath}" both use ${post.catalogNo}.`,
      );
    }
    seenCatalogNumbers.set(post.catalogNo, post.sourceFilePath);

    for (const [index, route] of [post.routePath, ...post.aliases].entries()) {
      const claim = index === 0 ? "slug" : "alias";
      const existing = seen.get(route);
      if (existing) {
        throw new Error(
          `Blog URL collision: "${existing.sourceFilePath}" (${existing.claim}) and ` +
            `"${post.sourceFilePath}" (${claim}) both claim /blog/${route}/. ` +
            "No article was removed: give every slug and alias a globally unique value.",
        );
      }
      seen.set(route, { claim, sourceFilePath: post.sourceFilePath });
    }
  }

  return allPosts
    .filter((post) => !post.entry.data.draft)
    .sort((left, right) => {
      const dateDifference = (right.date?.getTime() || 0) - (left.date?.getTime() || 0);
      return dateDifference || pathCollator.compare(left.slug, right.slug);
    });
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
  return post.category;
}

export function uniqueBlogTags(posts: BlogPost[]) {
  return [...new Set(posts.flatMap((post) => post.tags))].sort(pathCollator.compare);
}

export function uniqueBlogCategories(posts: BlogPost[]) {
  const used = new Set(posts.map((post) => post.category));
  return BLOG_CATEGORIES.filter((category) => used.has(category));
}
