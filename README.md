# 有点来电

罗忆歌的单页静态个人网站，用来展示个人信息、记录生活与学习，并在浏览器本地保存笔记和留言。

## 功能

- 开场与个人介绍
- 本地笔记库：搜索、分类、编辑、Markdown 导入与导出
- 本地留言墙：图片、文字、编辑与删除
- 响应式布局与动画效果

笔记、留言和上传内容只保存在当前浏览器的 `localStorage` 中，不依赖服务器、数据库或 API。

## 本地开发

需要 Node.js 22.12 或更高版本。

使用 npm：

```bash
npm install
npm run dev
```

或使用 pnpm：

```bash
pnpm install
pnpm dev
```

## 构建与预览

```bash
# npm
npm run build
npm run preview

# pnpm
pnpm build
pnpm preview
```

构建产物位于 `_site/`。运行构建后，可用 `npm run check:pages` 或 `pnpm check:pages` 检查静态产物。

## GitHub Pages 部署

推送到 `main` 后，[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) 会自动：

1. 安装依赖并构建静态站；
2. 检查 `_site/` 产物；
3. 将产物推送到 `gh-pages` 分支。

也可以在 GitHub 的 **Actions → Build and deploy static site → Run workflow** 中手动执行。

仓库的 **Settings → Pages → Build and deployment** 应设置为：

- **Source**：Deploy from a branch
- **Branch**：`gh-pages` / `(root)`

站点使用根路径和 `public/CNAME` 中的自定义域名。不要同时启用另一套 GitHub Pages Actions 发布流程。
