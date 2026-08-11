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

生成数据库迁移与部署构建：

```bash
npm run db:generate
npm run build
```

## GitHub Pages 发布

推送到 `main` 后，`.github/workflows/deploy-pages.yml` 会检查并构建静态站点，
再将 `_site/` 的内容同步到 `gh-pages` 分支。也可以在 GitHub 的
**Actions → Build and publish GitHub Pages → Run workflow** 中手动执行。

仓库的 **Settings → Pages → Build and deployment** 应设置为：

- **Source**：Deploy from a branch
- **Branch**：`gh-pages` / `(root)`

请勿同时选择 GitHub Actions 作为第二条 Pages 发布路径，否则两次部署会争用同一个
Pages 环境并出现 `due to in progress deployment` 错误。

提交前可在本地验证 Pages 产物：

```bash
npm run check:syntax
npm run build:pages
npm run check:pages
```
