import react from "@astrojs/react";
import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkMath from "remark-math";

export default defineConfig({
  site: "https://loadingvibe.com",
  output: "static",
  trailingSlash: "always",
  integrations: [react(), sitemap()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex, rehypeSlug],
    }),
    shikiConfig: {
      theme: "github-dark",
      wrap: true,
    },
  },
});
