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
catalogNo: F-004
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

## 博客侧栏分类

侧栏包含「知识库」和「朋友圈」两类，新文章可以分别放入 `Blog/知识库/` 和 `Blog/朋友圈/`，并在其中继续创建主题子目录。最外层目录决定侧栏分类，不会改动 `slug` 或永久 F 编号。

旧文章无需迁移：未使用这两个顶层目录时，`category: 生活` 归入「朋友圈」，其余类别归入「知识库」。各分类直接按文章 `date` 从新到旧列出记录，日期相同时按 `slug` 稳定排序；源文件仍可按子目录整理，但侧栏不显示子目录或数量数字。没有已发布内容时显示空状态，不会生成占位文章。

## 字段规则

| 字段 | 必填 | 用途与规则 |
| --- | --- | --- |
| `title` | 是 | 文章标题，1–120 个字符 |
| `slug` | 是 | 全站唯一的稳定 URL；只能使用小写 ASCII 字母、数字和单个连字号 |
| `catalogNo` | 是 | 发布后永久不变的正文编号，使用 `F-001` 形式，并且全站唯一 |
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

`catalogNo` 是书内永久身份。新文章应使用尚未占用的下一个编号；即使以后修改 slug，也不要修改已经发布过的 `catalogNo`。阅读页不再提供文章评论区或上一篇／下一篇导航。

## 文件是文章的身份

- `Blog/` 中每一个 Markdown 文件都是一篇独立文章。只要源文件不同（包括仅文件名不同）就会保留；站点不比较正文哈希，也不会因为正文相同就删除、合并或隐藏其中一篇。
- 两个文件可以拥有相同正文，但必须使用不同的 `slug`。这时它们会生成两个独立页面，并各自进入档案和搜索结果。
- 如果任意两篇文章的 `slug` 或 `aliases` 占用了同一条 URL，构建会明确列出两个冲突的源文件并失败；它不会静默丢弃任何文章。

## 管理与安全删除

构建会为每篇文章生成以下非 frontmatter 字段：

| 字段 | 内容 |
| --- | --- |
| `sourceFilePath` | 仓库中的完整源文件路径，例如 `Blog/笔记/例子.md` |
| `githubManageUrl` | `main` 分支上该源文件的 GitHub 查看/管理页 |
| `githubDeleteUrl` | `main` 分支上该源文件的 GitHub 删除确认页 |

网站不保存 GitHub Token，也不会在点击链接时直接删除文件。「在 GitHub 删除」只会打开 GitHub 的确认页；实际操作受 GitHub 登录、仓库写入权限、分支保护和最后提交确认控制。访客看到链接也不等于拥有删除权限；详细权限与确认流程参见 [GitHub 官方删除文件说明](https://docs.github.com/en/repositories/working-with-files/managing-files/deleting-files-in-a-repository)。

在 GitHub 确认并将删除提交到 `main` 后，自动部署会重新构建站点，该文章才会从网站、搜索、RSS 和 sitemap 中消失。如果只想暂时下线，优先把 `draft` 改为 `true`，而不是删除文件。

> Git 删除不会清除历史记录。如果文件曾包含 Token、密码或其他敏感信息，请立即撤销相关凭据，并按 GitHub 的敏感数据清理流程处理仓库历史。

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

也可以继续使用现有的 `![说明](./文章名.assets/图片.png)` 相对路径。正文图片保持原始宽高比：超过正文宽度时等比例缩小，小图不放大；不需要在 Markdown 中手动设置宽高。

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

博客页尾的 `LAST BUILD` 显示当前发布版本的部署构建时间（北京时间），不是访问时间，也不是 GitHub Pages 完成发布的精确时刻。工作流在构建前固定 `SITE_DEPLOYMENT_BUILD_TIME`，同一时间会随页面保存到 `/deployment-build.json`；失败构建不会更新线上记录。本地预览和普通本地构建读取已获取的 `origin/gh-pages` 中的发布记录，旧版本则使用该部署分支的提交时间；执行 `git fetch origin gh-pages` 后，重启本地预览或重新构建即可刷新记录。没有部署记录时显示“尚无部署记录”，不会使用当前时间兜底。

`Blog/README.md` 不会被发布，但写作说明仍应放在 `docs/`。下划线开头的文件或目录、`.assets` 资源目录中的辅助 Markdown 不会进入内容集，但如果提交到公开 Git 仓库，源码仍然公开。

真正私密的本地草稿应放在仓库根目录的 `.private-drafts/` 中；该目录已被 `.gitignore` 排除，也不会被网站读取。不要把密码、令牌、私人身份信息或其他敏感内容放进 `Blog/`，即使文章设置了 `draft: true`。
