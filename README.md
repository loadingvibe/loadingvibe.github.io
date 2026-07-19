# Loading Vibe

Loading Vibe 是一个无框架、可直接部署的播客策展静态网站。它收录 8 档中英文节目，并通过分类、搜索和三种目录视图，帮助读者快速找到值得深入收听的内容。

## 本地预览

项目没有安装或构建步骤。Windows 用户可在 PowerShell 中运行：

```powershell
cd D:\loadingvibe.com
py -m http.server 4173 --bind 127.0.0.1
```

若系统未提供 `py` 命令，请改用：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

随后打开 [http://127.0.0.1:4173](http://127.0.0.1:4173)。预览结束后，在终端按 `Ctrl+C` 停止服务。

> 不建议直接双击 `index.html` 进行完整验收；本地 HTTP 服务更接近实际部署环境，也能更准确地发现资源路径问题。

部署流程如需独立的发布目录，可运行零依赖静态打包：

```powershell
npm run build
```

命令只会把 `index.html`、`styles.css`、`script.js` 和 `assets/` 复制到 `dist/`，不会改变源码。

## 文件结构

```text
loadingvibe.com/
├─ index.html                         # 语义化页面、8 档节目内容与交互控件
├─ styles.css                         # 设计变量、响应式布局、三种视图与动效
├─ script.js                          # 搜索、筛选、视图切换和偏好持久化
├─ assets/
│  └─ covers/                         # 本地节目封面（JPEG / PNG）
├─ product-facts.md                   # 参考页面与封面来源记录
├─ docs/
│  ├─ design-reference-analysis.md    # 参考站形式提炼与视觉方向
│  └─ superpowers/plans/
│     └─ 2026-07-19-loading-vibe-static-site.md
│                                      # 实施计划与验收标准
└─ README.md
```

## 添加或更新节目

所有节目内容都写在 `index.html` 中，因此即使 JavaScript 不可用，节目仍应可见、可读、可点击。

添加节目时：

1. 将获得授权或来自节目官方公开页面的方形封面放入 `assets/covers/`，使用简短、稳定的小写文件名。
2. 在 `index.html` 的 `.catalog` 中复制一篇现有的 `.show-card`，更新节目名称、简介、主持人或语言等元数据、官方链接和图片路径。
3. 设置准确的 `data-category`、`data-language` 与 `data-search`。`data-search` 应包含节目名、主持人及主要主题关键词，便于中英文搜索。
4. 为封面填写有意义的 `alt` 文本；外部链接保留 `target="_blank"` 与 `rel="noreferrer"`。
5. 若引入新分类，同步添加对应的 `[data-filter]` 控件，并检查分类名称与卡片数据完全一致。
6. 在 `product-facts.md` 中补充节目页面、核验日期和封面来源。

更新现有节目时，直接修改对应 `.show-card` 的可见内容与数据属性；若更换封面或来源链接，也要同步更新 `product-facts.md`。修改后请重新执行下方核对清单。

## 设计参考摘要

本站没有复刻任何单一参考站，而是将三类形式重新组合：

- **深读编辑部**：借鉴 Dwarkesh Podcast 与硅谷101清晰、克制的内容层级和长阅读感。
- **媒体海报**：借鉴 20VC 的超大标题、强对比和快速首屏节奏。
- **节目书架**：借鉴 Acquired、Spotify 与小宇宙以封面为索引、行动路径紧凑的目录体验。

默认的 `Editorial Grid` 强调内容层级；`Cover Wall` 强调封面浏览；`Compact List` 提升信息密度。三种视图改变的是布局与阅读节奏，而不只是颜色。

核心视觉采用暖纸色 `#F2EEE5`、墨色 `#11110F`、朱橙 `#F4511E` 和辅助灰 `#79766F`。中文标题优先使用系统宋体，正文使用系统无衬线字体，不依赖远程字体。桌面端使用 12 栏网格，移动端收束为单栏，封面始终保持 1:1。

更完整的参考拆解见 `docs/design-reference-analysis.md`。

## 图片来源与使用说明

当前封面用于识别节目并链接至其公开页面，项目不主张对这些图片拥有所有权：

- Dwarkesh Podcast、20VC、Acquired：Apple Podcasts 公开节目元数据中的方形封面。
- 听懂涨声、肥话连篇、面基、OnBoard!：各节目小宇宙公开页面的 `og:image`。
- 硅谷101：Fireside 公开节目页面的封面。

详细核验记录见 `product-facts.md`。公开部署、商业使用或替换素材前，请再次确认相应授权和平台条款；不要加入来源不明的第三方图片。

## 验证清单

- [ ] 通过本地 HTTP 服务打开页面，控制台无错误，所有本地资源均成功加载。
- [ ] 禁用 JavaScript 后，8 张 `.show-card` 仍然可见，节目链接和封面替代文本有效。
- [ ] “全部”及各分类筛选正确，搜索支持节目名和主题关键词，结果计数同步更新。
- [ ] `Editorial Grid`、`Cover Wall`、`Compact List` 三种视图均可切换。
- [ ] 切换视图后刷新页面，`loading-vibe-view` 偏好仍然生效。
- [ ] 在 1440 × 1000 与 390 × 844 视口下无水平滚动，封面保持方形，正文可读。
- [ ] 移动端按钮和输入控件的可点击区域至少为 44 × 44px，键盘焦点清晰可见。
- [ ] 系统启用“减少动态效果”后，页面遵循 `prefers-reduced-motion`，内容不会因动效不可见。
- [ ] 8 个外部节目链接均指向正确来源，并在新标签页安全打开。
