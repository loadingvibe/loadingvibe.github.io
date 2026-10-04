import react from "@astrojs/react";
import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkMath from "remark-math";
import { fileURLToPath } from "node:url";
import blogAssetsIntegration from "./src/integrations/blog-assets.mjs";
import blogPreview from "./src/integrations/blog-preview.mjs";
import { remarkBlogAssets, rehypeBlogAssets } from "./src/lib/blog-assets.mjs";
import { readBlogSources, encodeBlogRoute } from "./src/lib/blog-content.mjs";
import { remarkBlogLinks, rehypeBlogLinks } from "./src/lib/blog-links.mjs";

let canonicalBlogPaths;

export default defineConfig({
  site: "https://loadingvibe.com",
  output: "static",
  trailingSlash: "always",
  devToolbar: {
    enabled: false,
  },
  integrations: [
    react(),
    blogAssetsIntegration(),
    blogPreview(),
    sitemap({
      filter(page) {
        if (["/motion-review/", "/blog/"].includes(new URL(page).pathname)) return false;
        const match = new URL(page).pathname.match(/^\/blog\/(.+)\/$/u);
        if (!match) return true;

        canonicalBlogPaths ??= new Set(readBlogSources(fileURLToPath(new URL("./Blog", import.meta.url)))
          .filter((source) => !source.data.draft)
          .map((source) => `/blog/${encodeBlogRoute(source.data.slug)}/`));
        return canonicalBlogPaths.has(new URL(page).pathname);
      },
    }),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkBlogLinks, remarkBlogAssets, remarkMath],
      rehypePlugins: [rehypeBlogLinks, rehypeBlogAssets, [rehypeKatex, { throwOnError: false, strict: "ignore" }], rehypeSlug],
    }),
    shikiConfig: {
      theme: "github-dark",
      wrap: true,
    },
  },
});
