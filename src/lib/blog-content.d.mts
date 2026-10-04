export interface BlogDocumentData extends Record<string, unknown> {
  title: string;
  slug: string;
  catalogNo: string;
  summary: string;
  category: string;
  tags: string[];
  aliases: string[];
  draft: boolean;
  featured: boolean;
  date?: Date;
  updated?: Date;
  cover?: string;
  authorWarnings: string[];
}
export interface BlogSource {
  id: string;
  filePath: string;
  data: BlogDocumentData;
  body: string;
  warnings: string[];
}
export const BLOG_EXTENSIONS: Set<string>;
export function isBlogSource(sourcePath: string): boolean;
export function listBlogFiles(directory: string, prefix?: string): string[];
export function normalizeBlogRoute(value: unknown): string;
export function encodeBlogRoute(route: string): string;
export function plainBlogText(body: string): string;
export function readBlogDocument(contents: string, sourcePath: string): Pick<BlogSource, "data" | "body" | "warnings">;
export function resolveBlogEntries<T extends Pick<BlogSource, "id" | "filePath" | "data">>(entries: T[]): T[];
export function readBlogSources(blogRoot: string): BlogSource[];
