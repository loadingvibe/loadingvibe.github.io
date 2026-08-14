# 有点来电

「有点来电」是使用 [Astro](https://astro.build/) 构建的静态个人网站与 Markdown 博客。文章放在仓库根目录的 `Blog/` 中，构建后会生成可直接部署到 GitHub Pages 的 HTML、RSS 和 sitemap，不需要数据库或服务端运行环境。

## 写一篇文章

在 `Blog/` 下新建任意层级的 `.md` 文件，例如：

```text
Blog/
├── README.md
└── 技术与学习/
    └── 数学/
        └── 从梯度下降开始.md
```

构建会递归读取 `Blog/**/*.md`。推荐在文章开头填写 frontmatter：

```yaml
---
title: 从梯度下降开始
date: 2026-08-12
summary: 用一个最小例子理解梯度、学习率与迭代更新。
tags:
  - 数学
  - 机器学习
slug: gradient-descent
draft: false
---
```

- `title`：文章标题。
- `date`：发布日期，推荐使用 `YYYY-MM-DD`。
- `summary`：显示在文章列表和 RSS 中的摘要。
- `tags`：标签数组，也可以写成 `[数学, 机器学习]`。
- `slug`：可选的 URL 名称。单段值只替换文件名并保留父目录；含 `/` 的值表示 `blog/` 下的完整自定义路径。
- `draft`：设为 `true` 时不生成文章页面，也不会进入列表、RSS 或 sitemap。

如果不设置 `slug`，URL 会保留 `Blog/` 下的目录和文件名。例如 `Blog/随笔/春天.md` 对应 `/blog/随笔/春天/`。上面的嵌套示例设置了 `slug: gradient-descent`，因此对应 `/blog/技术与学习/数学/gradient-descent/`。`Blog/README.md` 设置了 `slug: writing-guide`，对应 `/blog/writing-guide/`。

更完整的 Markdown、数学公式和资源引用示例见 [`Blog/README.md`](Blog/README.md)。

## 图片与其他静态资源

把需要原样发布的文件放在 `public/` 下，并在 Markdown 中使用以 `/` 开头的网站绝对路径：

```text
public/assets/blog/gradient/chart.png
```

```md
![梯度下降曲线](/assets/blog/gradient/chart.png)
```

`public/` 本身不会出现在 URL 中。对于嵌套文章，推荐这种根路径写法，避免相对路径随文章目录深度变化。外部的 `https://` 图片链接也可以直接使用。

## 本地开发与检查

需要 Node.js 22.12 或更高版本。

```bash
npm install
npm run dev
```

开发服务器会监听 Markdown 和站点源码的变化。发布前执行：

```bash
npm run build
npm run check
```

`npm run build` 将完整静态站生成到 `dist/`；`npm run check` 检查首页、博客列表、示例文章、RSS、sitemap、自定义域名文件和品牌资源。检查命令读取已有的 `dist/`，因此应在构建之后运行。需要本地浏览最终产物时可执行 `npm run preview`。

## GitHub Pages 发布

推送到 `main` 后，[部署工作流](.github/workflows/deploy-pages.yml) 会安装依赖、执行构建与产物检查，再将 `dist/` 发布到 `gh-pages` 分支。也可以在 GitHub 的 **Actions → Build and deploy static site → Run workflow** 中手动触发。

仓库的 **Settings → Pages → Build and deployment** 应设置为：

- **Source**：Deploy from a branch
- **Branch**：`gh-pages` / `(root)`

自定义域名由 `public/CNAME` 配置，`public/.nojekyll` 会阻止 GitHub Pages 对产物做额外的 Jekyll 处理。构建还会输出 `/rss.xml` 和 sitemap，并通过 `public/robots.txt` 向搜索引擎声明 sitemap。若复制仓库到其他域名，请同时更新 Astro 的 `site` 配置、`public/CNAME` 和 `public/robots.txt`。
