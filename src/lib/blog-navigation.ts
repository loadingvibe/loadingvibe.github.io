import type { ArchiveTreeNode } from "../../components/BlogArchiveTree.astro";
import { formatBlogDate, type BlogPost } from "./blog";

export const BLOG_NAVIGATION_SECTIONS = ["知识库", "朋友圈"] as const;
export type BlogNavigationSectionName = (typeof BLOG_NAVIGATION_SECTIONS)[number];

export interface BlogNavigationSection {
  name: BlogNavigationSectionName;
  posts: BlogPost[];
  tree: ArchiveTreeNode;
}

/** Real top-level folders take priority; older posts keep their source paths. */
export function blogNavigationSection(post: BlogPost): BlogNavigationSectionName {
  const topLevel = post.directorySegments[0];
  if (topLevel === "知识库" || topLevel === "朋友圈") return topLevel;
  return post.category === "生活" ? "朋友圈" : "知识库";
}

/** Show a flat reading list; source folders only determine the two sections. */
export function createArchiveTree(items: BlogPost[]): ArchiveTreeNode {
  return {
    label: "",
    path: "",
    total: items.length,
    // getPublishedPosts sorts by creation date (newest first), then stable slug.
    posts: items.map((item) => ({
      href: item.href,
      routePath: item.routePath,
      title: item.title,
      dateLabel: formatBlogDate(item.date),
      dateTime: item.date?.toISOString(),
    })),
    children: [],
  };
}

export function createBlogNavigationSections(posts: BlogPost[]): BlogNavigationSection[] {
  return BLOG_NAVIGATION_SECTIONS.map((name) => {
    const sectionPosts = posts.filter((post) => blogNavigationSection(post) === name);
    return { name, posts: sectionPosts, tree: createArchiveTree(sectionPosts) };
  });
}
