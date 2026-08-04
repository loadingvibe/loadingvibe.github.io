# Markdown Authoring and Page Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the four browser feedback items and add a polished, offline-first Markdown article editor that works from both `file://` and the production build.

**Architecture:** Keep the recommendation page dependency-free and add a standalone `editor.html` entry point. The editor stores one draft in `localStorage`, renders Markdown with a small escaping-first parser, and imports/exports `.md` files entirely in the browser. Shared brand tokens remain in `styles.css`; editor-only layout and behavior live in focused files.

**Tech Stack:** Semantic HTML, layered CSS, vanilla JavaScript, localStorage, File/Blob APIs, inline SVG, Playwright verification, Vinext static public assets.

## Global Constraints

- Preserve direct `file:///D:/loadingvibe.com/index.html` usage without network dependencies.
- Keep the existing white, paper, near-black, and signal-orange visual system.
- Use the user-provided segmented loading mark only as design reference; ship a clean original SVG asset.
- Escape user-authored HTML before Markdown transforms so preview content cannot inject scripts.
- Maintain 44px minimum interactive targets on mobile and no horizontal overflow at 390px.

---

### Task 1: Apply Browser Feedback and Brand Update

**Files:**
- Create: `assets/brand/frequency-loader.svg`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app/layout.jsx`
- Test: `.playwright/verify.cjs`

**Interfaces:**
- Produces: shared `.wordmark__logo`, three-link `.site-nav`, and the site name `频率加载` used by the editor page.

- [ ] **Step 1: Update assertions before markup**

Change the expected document title to `频率加载 — 八个值得听完的节目`, brand text to `频率加载`, and navigation labels to `目录 / 总结 / 写文章`. Add assertions that navigation `::before` content is absent and the summary contains no back-to-top link.

- [ ] **Step 2: Add the vector mark and brand markup**

Create a transparent SVG with six blue segmented arcs and add it before the wordmark text. Replace header and footer brand copy with `频率加载`, add `写文章` linking to `editor.html`, and remove the summary back-to-top anchor.

- [ ] **Step 3: Remove navigation numbers and compact the featured card**

Delete the `01`/`02` pseudo-element rules. Center the feature body vertically, enlarge its description slightly, and change its CTA from `margin-top:auto` to a bordered content rail with a finite gap; restore stretch alignment on mobile.

- [ ] **Step 4: Run the existing responsive suite**

Run `node .playwright/verify.cjs`. Expected: desktop, 1081px, and 390px checks report `ok: true`, zero failed requests, and zero horizontal overflow.

### Task 2: Build the Markdown Writer Interface

**Files:**
- Create: `editor.html`
- Create: `editor.css`

**Interfaces:**
- Consumes: shared `styles.css` variables and brand header classes.
- Produces: `#article-title`, `#markdown-input`, `#markdown-preview`, `[data-action]`, `#markdown-import`, and `[data-save-status]` hooks for `editor.js`.

- [ ] **Step 1: Create semantic editor markup**

Build a writer header, action toolbar, title field, Markdown textarea, live preview article, count/status row, import input, and an aria-live toast. Use labels for every field and real buttons for actions.

- [ ] **Step 2: Add responsive writer styling**

Use a two-column editor/preview grid above 900px and a stacked layout below it. Keep both panes rectangular and editorial, provide a 44px toolbar target floor, style Markdown headings/lists/code/tables, and use a sticky preview only when enough viewport height exists.

### Task 3: Implement Safe Local-First Markdown Behavior

**Files:**
- Create: `editor.js`

**Interfaces:**
- Produces: `renderMarkdown(source: string): string`, `loadDraft(): Draft`, `saveDraft(): void`, `importMarkdown(file: File): Promise<void>`, and `exportMarkdown(): void`.
- Draft shape: `{ title: string, body: string, updatedAt: string }` stored at `frequency-loader.markdown-draft.v1`.

- [ ] **Step 1: Implement an escaping-first renderer**

Support headings, paragraphs, fenced code, blockquotes, unordered and ordered lists, task items, horizontal rules, links, images, bold, italic, strikethrough, and inline code. Run all source through `escapeHtml` and allow only `http:`, `https:`, `mailto:`, hash, and relative URLs.

- [ ] **Step 2: Add editing and persistence**

Render on input, debounce autosave by 320ms, update word/character counts, restore the last draft, insert two spaces on Tab, and support `Ctrl/Cmd+S` for save plus `Ctrl/Cmd+Shift+S` for export.

- [ ] **Step 3: Add import/export and reset**

Import UTF-8 `.md` files through a file input or drag/drop, use the first level-one heading as the title, export a Blob whose first line is `# {title}`, and confirm before clearing a non-empty draft.

### Task 4: Package and Verify the New Entry Point

**Files:**
- Modify: `build.mjs`
- Create: `.playwright/verify-editor.cjs`

**Interfaces:**
- Consumes: `editor.html`, `editor.css`, `editor.js`.
- Produces: `/editor.html` in both `public/` and the production bundle.

- [ ] **Step 1: Copy editor assets during build**

Extend the static file list in `build.mjs` to include the three editor files before invoking Vinext.

- [ ] **Step 2: Verify real editor workflows**

The Playwright check must type Markdown, confirm rendered `h1`, `h2`, strong text, list items, blockquote, and code; reload to confirm autosave; import a fixture through `setInputFiles`; capture desktop/mobile screenshots; and assert no console errors or overflow.

- [ ] **Step 3: Verify local and production modes**

Run `node .playwright/verify-editor.cjs`, `npm.cmd run build`, and `.playwright/verify-vinext.cjs` against `vinext start`. Expected: all images and editor assets load, the editor draft survives reload, and production checks finish without failed requests.
