---
title: 如何在这里写博客
date: 2026-08-13
summary: Blog 文件夹的写作说明，包含元数据、目录嵌套、资源路径与数学公式的用法。
tags:
  - 写作指南
  - Markdown
slug: writing-guide
---

这个网站会自动读取 `Blog` 文件夹中的所有 Markdown 文件。你可以直接新建 `.md` 文件，也可以按主题继续创建任意层级的文件夹；保存后，开发服务器会更新页面，正式构建则会为每篇已发布文章生成静态 HTML。

## 文章信息

在文件顶部使用 YAML frontmatter 描述文章：

```yaml
---
title: 文章标题
date: 2026-08-13
summary: 用一两句话介绍文章。
tags:
  - 技术
  - 随笔
slug: my-first-post
draft: false
---
```

`title`、`date`、`summary` 和 `tags` 会用于文章页、博客列表及订阅源。`slug` 和 `draft` 是可选项：

- 不写 `slug` 时，URL 使用文件在 `Blog/` 下的相对路径并移除 `.md`。
- 单段 `slug` 只替换文件名，父目录保持不变。例如 `Blog/技术/入门.md` 加上 `slug: getting-started` 后，URL 是 `/blog/技术/getting-started/`。
- 含 `/` 的 `slug` 是 `blog/` 下的完整自定义路径。例如 `slug: notes/getting-started` 对应 `/blog/notes/getting-started/`。
- `draft: true` 会让文章退出生成结果、博客列表、RSS 和 sitemap；准备发布时删除这一行或改成 `false`。

当前这份文件通过 `slug: writing-guide` 发布到 `/blog/writing-guide/`。

## 目录与链接

目录可以继续嵌套，例如：

```text
Blog/技术与学习/数学/从梯度下降开始.md
```

如果它设置 `slug: gradient-descent`，页面地址就是 `/blog/技术与学习/数学/gradient-descent/`。站内链接推荐直接写最终路径：

```md
[阅读梯度下降笔记](/blog/技术与学习/数学/gradient-descent/)
```

## 图片与附件

把图片或下载文件放进 `public/`，引用时省略 `public` 并从 `/` 开始：

```text
public/assets/blog/example/diagram.png
```

```md
![示意图](/assets/blog/example/diagram.png)
```

网站绝对路径不会受到文章目录层级影响，因此比 `./diagram.png` 更适合嵌套文章。

## Markdown 与数学公式

普通标题、列表、引用、代码块、链接和表格都可以直接书写。行内公式使用一对美元符号，例如 $E = mc^2$。

独立公式使用两对美元符号：

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$

## 本地预览与发布检查

在仓库根目录运行：

```bash
npm run dev
```

提交或发布前生成并检查完整静态站：

```bash
npm run build
npm run check
```

推送到 `main` 后，GitHub Actions 会把检查通过的 `dist/` 发布到 GitHub Pages。

> 保持记录。文件夹是书架，Markdown 就是你的纸。
