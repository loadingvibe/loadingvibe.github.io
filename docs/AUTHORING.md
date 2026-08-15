# Markdown 写作与发布

`Blog/` 是网站唯一的作者内容源。只有仓库作者能通过增加 Markdown 发布内容；网站访客只负责阅读、搜索和浏览，不会在浏览器里创建所谓的「公开记录」。

## 新建文章

1. 在 `Blog/` 中选择合适目录或新建目录。目录只用来整理源文件，不决定 URL。
2. 新建 `.md` 文件，复制下面的模板并填写所有必填字段。
3. 先设置 `draft: true` 进行本地写作；准备上线时改为 `false`。
4. 运行 `npm run build && npm run check`。元数据缺失、slug 冲突或无效日期都会让构建明确失败，避免发布一半成功的网站。
5. 提交并推送到 `main`：GitHub Actions 会自动构建、检查并部署到 GitHub Pages。

```md
---
title: 文章标题
slug: stable-english-slug
date: 2026-08-15
summary: 用一两句话说明这篇文章的内容和阅读价值。
category: 笔记
tags: [标签一, 标签二]
draft: true
featured: false
---

从这里开始写正文。文章标题已由页面模板输出，正文不要再写一个同名的一级标题。

## 第一节

正文……
```

## 字段规则

| 字段 | 必填 | 用途与规则 |
| --- | --- | --- |
| `title` | 是 | 文章标题，1–120 个字符 |
| `slug` | 是 | 全站唯一的稳定 URL；只能使用小写 ASCII 字母、数字和单个连字号 |
| `date` | 是 | 发布日期，使用 `YYYY-MM-DD` |
| `summary` | 是 | 列表、搜索及 RSS 摘要，不超过 240 个字符 |
| `category` | 是 | 只能是 `生活`、`工作`、`笔记` 或 `收藏` |
| `tags` | 否 | 搜索与筛选标签，最多 8 个 |
| `draft` | 否 | 默认 `false`；`true` 时不会生成页面、搜索项、RSS 或 sitemap |
| `featured` | 否 | 默认 `false`；用于选择首页精选文章 |
| `updated` | 否 | 更新日期，不能早于 `date` |
| `cover` | 否 | 封面图站内路径或完整网址 |
| `aliases` | 否 | 更换 slug 时保留的旧 blog 相对路径，不带 `/blog/` 和前后斜杠 |

`slug: stable-english-slug` 生成 `/blog/stable-english-slug/`。文件从一个目录移到另一个目录时，URL 不会改变。所有 slug 和 alias 都必须全站唯一，冲突时构建会指出涉及的两个源文件。

## Markdown、目录与大纲

- 使用 `##`、`###` 组织正文，站点会把这些标题生成右侧大纲。
- 页面模板已使用文章 `title` 生成唯一的 `h1`，正文通常从 `##` 开始。
- 标准 Markdown 标题、列表、引用、链接、表格和代码块都会被渲染。
- 行内数学公式使用 `$E = mc^2$`，独立公式使用两对美元符号。

## 图片与附件

把需要原样发布的文件放在 `public/assets/blog/` 下，并在 Markdown 中使用以 `/` 开头的路径：

```text
public/assets/blog/my-note/diagram.webp
```

```md
![图片的有意义替代文本](/assets/blog/my-note/diagram.webp)
```

## 本地检查与自动上线

```bash
npm run dev
npm run build
npm run check
git add Blog/ public/
git commit -m "content: publish a new note"
git push origin main
```

`git push origin main` 后，`.github/workflows/deploy-pages.yml` 会自动执行 `npm ci`、`npm run build` 和 `npm run check`，只在所有步骤成功时更新 `gh-pages`。

`Blog/README.md` 不会被发布，但写作说明仍应放在 `docs/`。临时素材或私有草稿可以放进下划线开头的文件/目录，它们也不会进入内容集。
