# 有点来电

「有点来电」是使用 [Astro](https://astro.build/) 构建的静态个人网站与笔记档案。`Blog/` 是唯一的作者内容源：作者在本地编辑文件，保存后实时预览网站，提交并推送后自动上线。

构建会为每篇已发布文章生成静态 HTML，并同步到阅读页左侧目录、RSS 和 sitemap，不需要数据库或服务端运行环境。博客入口直接打开 `F-004` 阅读页；如果该文章下线，则打开最新已发布文章。旧 `/blog/` 地址只负责自动跳转，不再提供独立目录页面。

## 写一篇文章

在 `Blog/` 下新建任意层级的 `.md`、`.markdown` 或 `.txt` 文件。中英文名称、空格和嵌套目录均可使用，例如：

```text
Blog/
├── 2026年知识库/
│   └── 数学/
│       └── 从梯度下降开始.md
├── 朋友圈/
│   └── 今天的记录.markdown
└── 随手记录.txt
```

直接写标题和正文即可，不需要 frontmatter：

```md
# 从梯度下降开始

用一个最小例子理解梯度、学习率与迭代更新。

## 第一节

正文……
```

网站会从正文标题或文件名取得文章标题，从正文生成摘要，并自动分配 URL 和 F 编号。没有分类时归为「笔记」。文件头的元数据是可选的；需要固定公开地址或补充日期、标签时再添加，例如：

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

- 所有元数据字段均可省略；兼容 YAML、JSON 和 TOML frontmatter，以及常见中英文别名字段。
- `slug` 可以使用中文、英文和嵌套路径。显式填写后，文件移动或重命名不会改变该地址；不填写时按源文件路径生成。
- `catalogNo` 可以指定已有的永久编号；新笔记会自动分配可用编号。已有文章应保留原编号和 `slug`。
- `category` 支持自定义分类；缺省为「笔记」。
- `tags` 支持数组，也支持用中英文逗号分隔的字符串。
- `draft: true` 的文章在本地开发中可见，正式构建时不生成页面，也不进入 RSS 或 sitemap。
- `featured`：设为 `true` 后可作为首页精选内容。

阅读页目录会自动使用 `Blog/` 下最外层文件夹的原名，例如「2026年知识库」和「朋友圈」。新建、重命名或删除文件夹会同步更新门类；每个门类前都有图标，嵌套目录中的文章归入最外层门类。直接放在 `Blog/` 的文章归入「未分类」。空文件夹也会显示；若要随 Git 提交上线，在其中放一个 `README.md`，因为 Git 不记录空目录。

每个门类按文章创建时间从新到旧排列，时间相同时按源文件路径的自然顺序排列。创建时间依次取 `created` / `createdAt` / `创建时间`、文章日期或路径日期、Git 首次加入记录、文件创建时间；修改正文不会改变创建顺序。需要固定排序时间时可写 `created: 2026-10-04T10:30:00+08:00`。

文章页标题前自动配有彩色 SVG 图标，按全部已发布文章的创建时间从早到晚依次分配。图库有 14 个图标，用完后从第一个循环；新增较晚创建的文章会继续使用下一个图标。草稿在本地预览中接着已发布文章分配，不影响已发布文章的图标。

重复 URL 和编号会自动避让并给出提示，保留所有源文件。若要维护长期公开链接，建议显式指定 `slug` 和 `catalogNo`。如果必须更换 `slug`，先把旧的 blog 相对路径加入 `aliases`。

站点递归读取 `Blog/`，排除 README、以 `_` 或 `.` 开头的文件或目录，以及 `.assets` 资源目录中的辅助文本。不完整的元数据会给出作者提示，本地仍可预览，修正前暂时按草稿处理。

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

博客正文图片、封面和头像自动支持灯箱：点击或按 Enter 放大，查看原始尺寸，并可下载原图。多张正文图片可用左右按钮或方向键切换，按 Esc 或点击空白区域关闭。远程图片若不允许跨域下载，可通过「查看原图」打开来源后保存。

## 本地开发与检查

需要 Node.js 22.12 或更高版本。

```bash
npm install
npm run dev
```

打开终端显示的本地地址（通常是 `http://localhost:4321`），然后一边编辑 `Blog/`，一边看实际阅读页。保存正文、增加文章、重命名或删除文件和文件夹都会更新页面和目录；不用每次重新构建。草稿也会出现在本地目录中。`npm run preview` 用于查看已有的 `dist/`，写作时使用 `npm run dev`。

发布前执行：

```bash
npm run build
npm run check
```

`npm run build` 将完整静态站生成到 `dist/`；`npm run check` 检查首页、博客入口跳转、当前文章、文件夹门类与创建时间顺序、RSS、sitemap、自定义域名文件和品牌资源。检查命令读取已有的 `dist/`，因此应在构建之后运行。需要本地浏览最终产物时可执行 `npm run preview`。

## GitHub Pages 发布

新增或修改 Markdown 后，把更改提交并推送到 `main`。[部署工作流](.github/workflows/deploy-pages.yml) 会自动安装依赖、校验元数据、构建与检查产物，然后将 `dist/` 发布到 `gh-pages` 分支。只把文件放进本地文件夹不会自动上传；`git push origin main` 才是自动上线流程的触发点。

也可以在 GitHub 的 **Actions → Build and deploy static site → Run workflow** 中手动触发。

仓库的 **Settings → Pages → Build and deployment** 应设置为：

- **Source**：Deploy from a branch
- **Branch**：`gh-pages` / `(root)`

自定义域名由 `public/CNAME` 配置，`public/.nojekyll` 会阻止 GitHub Pages 对产物做额外的 Jekyll 处理。构建还会输出 `/rss.xml` 和 sitemap，并通过 `public/robots.txt` 向搜索引擎声明 sitemap。若复制仓库到其他域名，请同时更新 Astro 的 `site` 配置、`public/CNAME` 和 `public/robots.txt`。
