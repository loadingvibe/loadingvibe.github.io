import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { blogLoader } from "./loaders/blog-loader";

// Validate normalized data; authors can begin with a plain note and add metadata later.
const blog = defineCollection({
  loader: blogLoader(),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    catalogNo: z.string(),
    summary: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    aliases: z.array(z.string()),
    draft: z.boolean(),
    featured: z.boolean(),
    date: z.date().optional(),
    createdAt: z.date().optional(),
    updated: z.date().optional(),
    cover: z.string().optional(),
    authorWarnings: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
