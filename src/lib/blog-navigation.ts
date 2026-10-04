import type { ArchiveTreeNode } from "../../components/BlogArchiveTree.astro";
import { compareBlogPostsByCreatedAt, formatBlogDate, type BlogPost } from "./blog";
import { blogDirectoryIcon, listBlogDirectories } from "./blog-directories.mjs";

export type BlogNavigationSectionName = string;

export interface BlogNavigationSection {
  name: BlogNavigationSectionName;
  icon: "book" | "people" | "folder";
  posts: BlogPost[];
  tree: ArchiveTreeNode;
}

/** The exact top-level source folder determines the section, regardless of category or slug. */
export function blogNavigationSection(post: BlogPost): BlogNavigationSectionName {
  return post.directorySegments[0] || "未分类";
}

/** Nested source folders contribute to their top-level folder's flat reading list. */
export function createArchiveTree(items: BlogPost[]): ArchiveTreeNode {
  return {
    label: "",
    path: "",
    total: items.length,
    posts: [...items].sort(compareBlogPostsByCreatedAt).map((item) => ({
      href: item.href,
      routePath: item.routePath,
      title: item.title,
      dateLabel: formatBlogDate(item.createdAt ?? item.date),
      dateTime: (item.createdAt ?? item.date)?.toISOString(),
    })),
    children: [],
  };
}

export function createBlogNavigationSections(
  posts: BlogPost[],
  directoryNames: string[] = listBlogDirectories(),
): BlogNavigationSection[] {
  const names = [...directoryNames];
  if (posts.some((post) => !post.directorySegments.length) && !names.includes("未分类")) names.push("未分类");
  return names.map((name) => {
    const sectionPosts = posts.filter((post) => blogNavigationSection(post) === name)
      .sort(compareBlogPostsByCreatedAt);
    return { name, icon: blogDirectoryIcon(name), posts: sectionPosts, tree: createArchiveTree(sectionPosts) };
  });
}
