import rss from "@astrojs/rss";
import { getPublishedPosts } from "../lib/blog";

export async function GET(context: { site?: URL }) {
  const posts = await getPublishedPosts({ includeDrafts: false });
  const escapeXml = (value: string) => value.replace(/[&<>"']/gu, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);

  return rss({
    title: "loadingvibe · 文章",
    description: "Roy 的学习笔记、技术总结与生活记录。",
    site: context.site || new URL("https://loadingvibe.github.io"),
    customData: "<language>zh-CN</language>",
    items: posts.map((post) => ({
      title: post.title,
      description: post.summary,
      link: post.href,
      customData: `<guid isPermaLink="false">loadingvibe:${escapeXml(post.catalogNo)}</guid>`,
      ...(post.date ? { pubDate: post.date } : {}),
      ...(post.tags.length ? { categories: post.tags } : {}),
    })),
  });
}
