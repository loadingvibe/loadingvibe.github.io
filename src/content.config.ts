import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const tagsSchema = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value
          .split(/[,，]/u)
          .map((tag) => tag.trim())
          .filter(Boolean)
      : value,
  z.array(z.string().trim().min(1)).default([]),
);

const blog = defineCollection({
  loader: glob({
    base: "./Blog",
    pattern: "**/*.md",
    generateId: ({ entry }) => entry.replace(/\.(?:md|mdx)$/iu, ""),
  }),
  schema: z.object({
    title: z.string().trim().min(1).optional(),
    date: z.coerce.date().optional(),
    summary: z.string().trim().optional(),
    tags: tagsSchema,
    draft: z.boolean().default(false),
    updated: z.coerce.date().optional(),
    cover: z.string().trim().min(1).optional(),
  }),
});

export const collections = { blog };
