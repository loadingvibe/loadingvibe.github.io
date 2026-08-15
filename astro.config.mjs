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
  integrations: [
    react(),
    sitemap({
      filter(page) {
        const match = new URL(page).pathname.match(/^\/blog\/(.+)\/$/u);
        if (!match) return true;

        // Canonical article slugs are one ASCII segment. Nested/legacy paths are
        // generated only as noindex compatibility redirects and stay out of sitemap.
        return /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(match[1]);
      },
    }),
  ],
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
