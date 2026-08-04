# Catalog and Footer Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the twelve browser comments by removing the editor-note section, simplifying and localizing the catalog controls, adding a direct-link cue in every view, and rebuilding the footer hierarchy.

**Architecture:** Preserve the existing static HTML/CSS/vanilla-JavaScript structure. Make copy and structure changes in `index.html`, keep all three existing view modes driven by `body[data-view-mode]`, and adapt existing selectors rather than introducing a new component framework.

**Tech Stack:** Semantic HTML5, layered CSS, vanilla JavaScript, Playwright browser checks, Vinext production build.

## Global Constraints

- Preserve the established black, warm-white, and orange visual system.
- Remove the complete `#about` section.
- Use the exact visible phrases `目录`, `八档节目 · 四个方向`, `选择你想听的内容`, `分类`, `搜索`, `改变排版`, and `点击直接到达博客 ↗`.
- Keep all eight external links opening in a new tab.
- Keep editorial, cover-wall, and compact-list views functional on desktop and mobile.
- Remove the `LV` footer mark and place the remaining brand block at the lower-left.
- Do not modify the unrelated untracked `bode_plot.png` file.

---

### Task 1: Simplify catalog structure and copy

**Files:**
- Modify: `D:/loadingvibe.com/index.html`
- Test: `D:/loadingvibe.com/.playwright/verify.cjs`

**Interfaces:**
- Consumes: Existing `data-filter`, `data-view`, `#show-search`, and `.show-card__cta` hooks.
- Produces: The same hooks with localized labels and `.show-card__tagline` wrappers.

- [ ] **Step 1: Add failing browser assertions**

Add assertions after navigation in `desktopCheck`:

```js
assert((await page.locator("#about").count()) === 0, "Editor note should be removed.");
assert(
  (await page.locator(".section-index--catalog").textContent())?.trim() === "目录",
  "Catalog label should be 目录.",
);
assert(
  (await page.locator("#shows-title").textContent())?.trim() === "选择你想听的内容",
  "Catalog title did not update.",
);
assert((await page.locator(".catalog-status").count()) === 0, "Catalog status should be removed.");
assert(
  (await page.locator(".show-card__cta b").allTextContents()).every(
    (text) => text.trim() === "点击直接到达博客 ↗",
  ),
  "Every card needs the direct-link cue.",
);
```

- [ ] **Step 2: Run the browser check and confirm it fails**

Run: `node .playwright/verify.cjs`

Expected: FAIL because `#about`, the old English section labels, and `.catalog-status` are still present.

- [ ] **Step 3: Apply the catalog HTML changes**

Delete the full `<section class="editor-note ...">...</section>`. Replace the catalog heading and toolbar labels with:

```html
<div class="section-index section-index--catalog">
  <span>目录</span>
</div>
<header class="catalog-header">
  <div>
    <p class="overline">八档节目 · 四个方向</p>
    <h2 id="shows-title">选择你想听的内容</h2>
  </div>
</header>
```

Use `分类`, `搜索`, and `改变排版` as the three `.tool-label` values and update their group labels to Chinese. Delete the complete `.catalog-status` element.

Wrap every English card tagline and use the same direct-link cue:

```html
<span class="show-card__cta">
  <span class="show-card__tagline">Deeply researched interviews</span>
  <b>点击直接到达博客 ↗</b>
</span>
```

The eight exact tagline values remain:

```text
Deeply researched interviews
Venture capital, without the polish
Every company has a story
Money decisions, lived in public
A warm, funny seat at the table
Ask why before following the crowd
Fresh technology, explained in context
From first idea to global company
```

- [ ] **Step 4: Run the focused assertions**

Run: `node .playwright/verify.cjs`

Expected: Catalog structure assertions pass; later footer assertions may still fail after they are added.

- [ ] **Step 5: Commit the catalog structure**

```bash
git add index.html
git commit -m "refactor: simplify listening catalog"
```

### Task 2: Make the direct-link cue work in every layout

**Files:**
- Modify: `D:/loadingvibe.com/styles.css`
- Test: `D:/loadingvibe.com/.playwright/verify.cjs`

**Interfaces:**
- Consumes: `.show-card__cta`, `.show-card__tagline`, `body[data-view-mode]`.
- Produces: A visible `点击直接到达博客 ↗` cue in editorial, covers, and list views.

- [ ] **Step 1: Add a three-view visibility test**

```js
for (const mode of ["editorial", "covers", "list"]) {
  await page.locator(`[data-view="${mode}"]`).click();
  const visibleCueCount = await page.locator(".show-card:not([hidden]) .show-card__cta b").evaluateAll(
    (elements) => elements.filter((element) => getComputedStyle(element).display !== "none").length,
  );
  assert(visibleCueCount === 8, `${mode} view should show 8 direct-link cues.`);
}
```

- [ ] **Step 2: Run the check and confirm cover/list views fail**

Run: `node .playwright/verify.cjs`

Expected: FAIL because the current covers view hides `.show-card__cta` and the current list view hides its `<b>`.

- [ ] **Step 3: Update view-specific CSS**

Keep the editorial CTA unchanged. In covers view hide only the tagline and show the CTA:

```css
body[data-view-mode="covers"] .show-card__body > p,
body[data-view-mode="covers"] .show-card__tagline {
  display: none;
}

body[data-view-mode="covers"] .show-card__cta {
  display: flex;
  justify-content: flex-start;
  margin-top: 14px;
  padding-top: 0;
}
```

In list view hide only the tagline and keep the `<b>` visible:

```css
body[data-view-mode="list"] .show-card__tagline {
  display: none;
}

body[data-view-mode="list"] .show-card__cta b {
  display: inline;
}
```

On mobile compact-list view keep `.show-card__cta` visible below the description:

```css
body[data-view-mode="list"] .show-card__cta {
  display: flex;
  margin-top: 10px;
}
```

- [ ] **Step 4: Run the browser check**

Run: `node .playwright/verify.cjs`

Expected: PASS for all three cue-visibility checks with no horizontal overflow.

- [ ] **Step 5: Commit the cross-view cue styling**

```bash
git add styles.css
git commit -m "feat: show direct-link cues in every catalog view"
```

### Task 3: Rebuild the footer and remove obsolete styles

**Files:**
- Modify: `D:/loadingvibe.com/index.html`
- Modify: `D:/loadingvibe.com/styles.css`
- Test: `D:/loadingvibe.com/.playwright/verify.cjs`

**Interfaces:**
- Consumes: Existing `#top`, `.site-footer`, `.wordmark__name`, and copyright copy.
- Produces: `.site-footer__brand`, `.site-footer__brand-name`, `.site-footer__note`, and `.site-footer__credit`.

- [ ] **Step 1: Add footer assertions**

```js
assert(
  (await page.locator(".site-footer .wordmark__mark").count()) === 0,
  "Footer LV mark should be removed.",
);
assert(
  (await page.locator(".site-footer__brand-name").textContent())?.trim() === "博客推荐",
  "Footer brand should match the header.",
);
assert(
  (await page.locator(".site-footer__credit").textContent())?.trim() === "loadingvibe.com · 2026",
  "Footer credit should be concise.",
);
```

- [ ] **Step 2: Replace the footer HTML**

```html
<footer class="site-footer">
  <div class="site-footer__brand">
    <a class="site-footer__brand-name" href="#top">博客推荐</a>
    <p>一份关于深度播客的独立静态索引。</p>
  </div>
  <p class="site-footer__note">
    节目封面与主页截图仅用于识别并链接至原始节目；版权归各节目发布方所有，本站不托管音频。
  </p>
  <p class="site-footer__credit">loadingvibe.com · 2026</p>
</footer>
```

- [ ] **Step 3: Replace the footer layout CSS and delete editor-note CSS**

Use this three-column, bottom-aligned desktop layout and stack it on mobile:

```css
.site-footer {
  display: grid;
  min-height: 230px;
  grid-template-columns: minmax(210px, 1fr) minmax(280px, 42ch) auto;
  align-items: end;
  gap: clamp(24px, 4vw, 64px);
  padding: clamp(44px, 6vw, 72px) var(--page-gutter) var(--space-3);
  border-top: 1px solid var(--line-light);
  background: var(--ink);
  color: var(--paper);
}

.site-footer__brand {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.site-footer__brand-name {
  font-family: var(--serif);
  font-size: clamp(28px, 3vw, 42px);
  font-weight: 700;
  letter-spacing: -0.045em;
  text-decoration: none;
  text-transform: none;
}

.site-footer__note {
  max-width: 42ch;
}

@media (max-width: 1120px) {
  .site-footer {
    grid-template-columns: minmax(0, 1fr) minmax(260px, 1fr);
  }

  .site-footer__brand {
    grid-row: 1 / span 2;
    align-self: end;
  }

  .site-footer__note,
  .site-footer__credit {
    grid-column: 2;
  }
}

@media (max-width: 760px) {
  .site-footer {
    display: flex;
    min-height: 0;
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-9);
  }

  .site-footer__brand {
    align-self: flex-start;
  }
}
```

Delete all `.editor-note__*` rules and their responsive overrides because `#about` no longer exists.

- [ ] **Step 4: Run final verification and build**

Run: `node .playwright/verify.cjs`

Expected: PASS at 1440×1000 and 390×844; no console errors, failed requests, missing alt text, or horizontal overflow.

Run: `npm.cmd run build`

Expected: `Build complete` and `Built Sites-compatible bundle in dist/`.

- [ ] **Step 5: Review only the intended working-tree paths**

Run: `git status --short`

Expected modified or new paths: `index.html`, `styles.css`, `script.js`, `assets/homepages/`, and this plan. `bode_plot.png` remains unmodified and unstaged.

- [ ] **Step 6: Commit the footer revision**

```bash
git add index.html styles.css docs/superpowers/plans/2026-08-03-catalog-footer-revision.md
git commit -m "refactor: simplify catalog footer"
```
