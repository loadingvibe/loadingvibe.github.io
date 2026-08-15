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
  z
    .array(z.string().trim().min(1, "tag 不能为空").max(30, "单个 tag 不能超过 30 个字符"))
    .max(8, "每篇文章最多使用 8 个 tag")
    .default([]),
).transform((tags) => [...new Set(tags)]);

const aliasesSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "alias 不能为空")
      .max(200, "单个 alias 不能超过 200 个字符")
      .refine(
        (value) =>
          !value.startsWith("/") &&
          !value.endsWith("/") &&
          !value.includes("//") &&
          !/[?#\\]/u.test(value) &&
          !value.split("/").some((segment) => segment === "." || segment === ".."),
        "alias 必须是不带前后斜杠、查询参数或锚点的旧 blog 路径",
      ),
  )
  .max(10, "每篇文章最多保留 10 个旧路径")
  .default([]);

const blogEntrySchema = z
  .object({
    title: z.string().trim().min(1, "title 不能为空").max(120, "title 不能超过 120 个字符"),
    slug: z
      .string()
      .trim()
      .min(1, "slug 不能为空")
      .max(80, "slug 不能超过 80 个字符")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/u,
        "slug 只能使用小写英文字母、数字和单个连字号，例如 my-first-note",
      ),
    date: z.coerce.date({ error: "date 必须是有效日期，建议使用 YYYY-MM-DD" }),
    summary: z
      .string()
      .trim()
      .min(1, "summary 不能为空")
      .max(240, "summary 不能超过 240 个字符"),
    category: z.enum(["生活", "工作", "笔记", "收藏"], {
      error: "category 必须是生活、工作、笔记或收藏之一",
    }),
    aliases: aliasesSchema,
    tags: tagsSchema,
    draft: z.boolean({ error: "draft 必须是 true 或 false" }).default(false),
    featured: z.boolean({ error: "featured 必须是 true 或 false" }).default(false),
    updated: z.coerce
      .date({ error: "updated 必须是有效日期，建议使用 YYYY-MM-DD" })
      .optional(),
    cover: z.string().trim().min(1, "cover 不能为空").optional(),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.updated && data.updated.getTime() < data.date.getTime()) {
      context.addIssue({
        code: "custom",
        message: "updated 不能早于 date",
        path: ["updated"],
      });
    }

    const seenAliases = new Set<string>();
    for (const [index, alias] of data.aliases.entries()) {
      if (alias === data.slug) {
        context.addIssue({
          code: "custom",
          message: "alias 不能与当前 slug 相同",
          path: ["aliases", index],
        });
      } else if (seenAliases.has(alias)) {
        context.addIssue({
          code: "custom",
          message: "aliases 中存在重复路径",
          path: ["aliases", index],
        });
      }
      seenAliases.add(alias);
    }
  });

const blog = defineCollection({
  loader: glob({
    base: "./Blog",
    pattern: [
      "**/*.md",
      "!**/[Rr][Ee][Aa][Dd][Mm][Ee].md",
      "!**/_*.md",
      "!**/_*/**/*.md",
    ],
    generateId: ({ entry }) => entry.replace(/\.(?:md|mdx)$/iu, ""),
  }),
  schema: blogEntrySchema,
});

export const collections = { blog };
