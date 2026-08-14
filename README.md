# 有点来电

罗忆歌的单页个人网站：一张简洁的个人名片，也是用来记录生活、工作与学习的长期笔记库。

## 当前内容

- 开场：沿用“有点来电”Logo 与名称，提供网站简介和页内目录。
- 关于我：基于作者简历展示姓名、年龄、学校、所在、籍贯与校园邮箱，不公开电话。
- 记录库：按生活、学习、工作、收藏与随笔组织，支持全文搜索、分类、标签、排序、折叠阅读和 Markdown 导出。
- 写作台：作者登录后可创建草稿或发布笔记，导入、导出 Markdown，上传图片与音频，也可直接录音。
- 留言墙：访客可选择一种“光影”并公开留言，内容以拍立得照片墙展示，作者可在写作台管理。

公开访问统一使用根路径 `/`，旧的 `/home`、`/notes`、`/notes/:slug` 与 `/wall` 地址会跳转到对应的单页区块。

## 数据

笔记与留言使用 Sites D1 持久化，图片与录音使用 Sites R2 保存。浏览器存储不作为主数据源。

## 旧站归档

改造前的播客策展站代码保留在 `archive/legacy-podcast-site/`，不会出现在新网站的页面中。原来的八档播客推荐已迁移为笔记库的第一篇内容。

## 本地开发

```bash
npm install
npm run dev
```

项目有两种产物：

```bash
npm run build:static  # 通用静态站，输出到 _site/
npm run build:sites   # 带 D1/R2 的 Sites 动态版，输出到 dist/
npm run build         # 同时构建两种产物
```

静态站使用浏览器本地存储保存文档和留言，适用于 GitHub Pages、Vercel 和纯静态 Cloudflare Worker。Sites 动态版使用 D1 和 R2。

一次验证三个部署入口：

```bash
npm run check:deploy
```

## 部署

### GitHub Pages

推送到 `main` 后，`.github/workflows/deploy-pages.yml` 会检查并构建静态站点，
再将 `_site/` 的内容同步到 `gh-pages` 分支。也可以在 GitHub 的
**Actions → Build and deploy GitHub Pages → Run workflow** 中手动执行。

仓库的 **Settings → Pages → Build and deployment** 应设置为：

- **Source**：Deploy from a branch
- **Branch**：`gh-pages` / `(root)`

请勿同时选择 GitHub Actions 作为第二条 Pages 发布路径，否则两次部署会争用同一个
Pages 环境并出现 `due to in progress deployment` 错误。

### Vercel

`vercel.json` 已将框架固定为 **Other**，并强制 Vercel 执行 `npm run build:static`、只发布 `_site/`。这会覆盖控制台里旧的构建命令和输出目录，避免再把仓库根目录的历史入口当成成品。

Vercel 项目只需确认：

- Production Branch 是 `main`
- Root Directory 留空（仓库根目录）

推送这些修改后重新部署即可。如果生产域名仍指向更旧的 Deployment，在 Vercel 中将最新的 `main` Deployment 设为 Production。

### Cloudflare Workers

`wrangler.jsonc` 已配置 Workers Static Assets 和 SPA 回退。Cloudflare 的 Git 构建可使用：

- Build command：`npm run build:static`
- Deploy command：`npx wrangler deploy --config wrangler.jsonc --autoconfig=false`
- Root directory：`/`

也可在已登录 Wrangler 的本机直接执行：

```bash
npm run deploy:cloudflare
```
