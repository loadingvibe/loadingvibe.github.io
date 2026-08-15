# 有点来电

「有点来电」是使用 [Astro](https://astro.build/) 构建的静态个人网站与 Markdown 档案。`Blog/` 是唯一的作者内容源：作者在仓库中编辑 Markdown，访客在网站上阅读和搜索。网页不再提供基于浏览器本地存储的发布编辑器，因此不会把访客的本地数据误表述为公开文章。

构建会为每篇已发布文章生成静态 HTML，并同步到列表、搜索数据、RSS 和 sitemap，不需要数据库或服务端运行环境。

## 写一篇文章

在 `Blog/` 下新建任意层级的 `.md` 文件，例如：

```text
Blog/
├── 技术与学习/
│   └── 数学/
│       └── 从梯度下降开始.md
└── 收藏/
    └── 播客/
        └── 八档值得长期收听的播客.md
```

构建会递归读取 `Blog/**/*.md`，并且不会发布 `README.md`、下划线开头的文件或目录。每篇文章必须提供完整 frontmatter：

```yaml
---
title: 从梯度下降开始
slug: gradient-descent-intro
catalogNo: F-002
date: 2026-08-12
summary: 用一个最小例子理解梯度、学习率与迭代更新。
category: 笔记
tags:
  - 数学
  - 机器学习
draft: false
featured: false
---
```

- `title`、`date`、`summary`、`slug`、`catalogNo` 和 `category` 是必填字段。
- `slug` 只能使用小写 ASCII 字母、数字与单个连字号，并且在全站唯一。
- `catalogNo` 是发布后不再更改的永久正文编号，使用 `F-001` 形式，并且在全站唯一。
- `category` 只能是 `生活`、`工作`、`笔记` 或 `收藏`。
- `tags` 是最多 8 个标签的数组，也可以写成 `[数学, 机器学习]`。
- `draft`：设为 `true` 时不生成文章页面，也不会进入列表、RSS 或 sitemap。
- `featured`：设为 `true` 后可作为首页精选内容。

文章 URL 由 `slug` 唯一决定，与 Markdown 文件名和目录无关。例如上面的文章始终使用 `/blog/gradient-descent-intro/`；移动或重命名文件不会破坏公开链接。如果必须更换 `slug`，先把旧的 blog 相对路径加入 `aliases`。

完整的写作、校验、Markdown 和资源引用说明见 [`docs/AUTHORING.md`](docs/AUTHORING.md)。写作文档放在 `docs/` 而非 `Blog/`，避免被误发布。

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

新增或修改 Markdown 后，把更改提交并推送到 `main`。[部署工作流](.github/workflows/deploy-pages.yml) 会自动安装依赖、校验元数据、构建与检查产物，然后将 `dist/` 发布到 `gh-pages` 分支。只把文件放进本地文件夹不会自动上传；`git push origin main` 才是自动上线流程的触发点。

也可以在 GitHub 的 **Actions → Build and deploy static site → Run workflow** 中手动触发。

仓库的 **Settings → Pages → Build and deployment** 应设置为：

- **Source**：Deploy from a branch
- **Branch**：`gh-pages` / `(root)`

自定义域名由 `public/CNAME` 配置，`public/.nojekyll` 会阻止 GitHub Pages 对产物做额外的 Jekyll 处理。构建还会输出 `/rss.xml` 和 sitemap，并通过 `public/robots.txt` 向搜索引擎声明 sitemap。若复制仓库到其他域名，请同时更新 Astro 的 `site` 配置、`public/CNAME` 和 `public/robots.txt`。
