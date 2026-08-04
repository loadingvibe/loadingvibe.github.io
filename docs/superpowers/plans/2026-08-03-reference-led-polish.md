# Reference-led Website Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the existing podcast recommendation site with Refero-style editorial hierarchy, Motion Sites-style restrained motion, and React Bits-inspired micro-interactions while preserving all eight programs, filters, links, and three catalog views.

**Architecture:** Keep `index.html` as the semantic content source, `styles.css` as the layered design system, and `script.js` as the only interaction layer. The Vinext wrapper continues to render the same HTML source; `public/` and `dist/` remain generated outputs. Visual changes use existing local assets and native CSS/JavaScript only.

**Tech Stack:** Semantic HTML5, layered modern CSS, vanilla JavaScript, Playwright browser verification, Vinext production build.

## Global Constraints

- Preserve the user-approved brand name `博客推荐`, white header, navigation labels `目录` and `总结`, date `2026/8/3`, and hero title `八个博客 / 推荐给你`.
- Preserve all eight podcast entries, their original destinations, filtering, search, and editorial/cover/list view switching.
- Preserve the exact visible direct-link phrase `点击直接到达博客 ↗` in every catalog view.
- Keep the warm paper, near-black, and single orange accent palette; add no gradients, WebGL, cursor replacement, or third-party animation framework.
- Every automatic or animated behavior must stop under `prefers-reduced-motion: reduce`.
- Do not hand-edit `public/` or `dist/`; regenerate them only through `npm.cmd run build`.
- Preserve unrelated user files and changes, especially `bode_plot.png`.

---

### Task 1: Strengthen content hierarchy and link semantics

**Files:**
- Modify: `D:/loadingvibe.com/index.html`
- Modify: `D:/loadingvibe.com/app/layout.jsx`
- Modify: `D:/loadingvibe.com/assets/covers/mianji.jpg`
- Test: `D:/loadingvibe.com/.playwright/verify.cjs`

**Interfaces:**
- Consumes: Existing `.homepage-slide`, `[data-slide-to]`, `.show-card`, and `#summary` hooks.
- Produces: Stable slide IDs, `aria-controls` relationships, Chinese audience lines, and a real summary heading.

- [ ] **Step 1: Add semantic assertions**

Assert in `desktopCheck` that the active homepage item has the native `link` role, every quick-navigation button has `aria-controls`, all eight card labels mention a new window, the summary contains an `h2`, and the metadata title is `博客推荐 — 八个值得听完的节目`.

- [ ] **Step 2: Verify the assertions fail**

Run: `node .playwright/verify.cjs`

Expected: FAIL because homepage links currently use `role="group"`, quick-navigation buttons have no `aria-controls`, and `#summary` has no heading.

- [ ] **Step 3: Update hero, slides, cards, and summary markup**

Use the existing hero copy but open with `这里推荐的是 8 档播客` to resolve the blog/podcast naming ambiguity. Give each slide an ID such as `homepage-slide-01`, remove `role="group"`, describe the new-window destination in its `aria-label`, and change `Homepage / 01` to `访问主页 / 01 ↗`. Add matching `aria-controls` and explicit labels to the eight quick-navigation buttons.

Replace each English `.show-card__tagline` with a short Chinese audience description beginning with `适合：`. Expand every card link label to include its program name, theme, and `新窗口打开`, and normalize `rel="noopener noreferrer"`.

Replace the English-only summary with:

```html
<section class="closing-statement" id="summary" aria-labelledby="summary-title">
  <p class="overline">听完，比听多更重要</p>
  <h2 class="closing-statement__line" id="summary-title">
    从技术趋势与公司战略，<span>回到钱、选择与普通生活。</span>
  </h2>
  <p class="closing-statement__copy">
    这八档节目适合愿意听完整论证、关心变化，也想形成自己判断的人。
  </p>
  <a class="text-link text-link--light" href="#top">回到页首 <span aria-hidden="true">↑</span></a>
</section>
```

- [ ] **Step 4: Synchronize Vinext metadata**

Set the layout title to `博客推荐 — 八个值得听完的节目`, use the same Chinese description as the static page, and change the viewport theme color to `#ffffff` so browser chrome matches the user-approved white header.

- [ ] **Step 5: Optimize the largest local cover**

Convert `assets/covers/mianji.png` to a high-quality `assets/covers/mianji.jpg`, update the one HTML reference, and verify its dimensions remain square and its file size is materially smaller than 1.34 MB.

### Task 2: Rebalance the editorial visual system

**Files:**
- Modify: `D:/loadingvibe.com/styles.css`
- Modify: `D:/loadingvibe.com/index.html`
- Test: `D:/loadingvibe.com/.playwright/verify.cjs`

**Interfaces:**
- Consumes: Existing CSS layers, card modifier classes, and view-mode body attribute.
- Produces: Explicit grid-span modifiers, lighter signal navigation, refined typography, and a visible slider progress line.

- [ ] **Step 1: Make card spans semantic**

Add `show-card--wide` to 20VC and 面基, add `show-card--landscape` to 硅谷101, and add `show-card--hero` to OnBoard. Remove the obsolete wide modifier from 肥话连篇. Replace all `nth-child` and `:last-child` layout dependencies with these modifiers and enable `grid-auto-flow: dense`.

- [ ] **Step 2: Refine global and hero tokens**

Keep the sticky header pure white, remove its ineffective blur, reduce hero grid contrast, relax Chinese title tracking to about `-0.03em`, increase line-height to about `0.9`, and cap the desktop title near `150px`. Make both title lines solid and readable. Reduce the homepage frame to 4px and its shadow to `0 16px 36px rgb(0 0 0 / 26%)`.

- [ ] **Step 3: Add restrained image feedback**

Add a low-opacity diagonal glare on `.homepage-slide` for hover and focus-visible only. Add an inline progress bar inside `.homepage-slider__meta`; its fill is driven by the existing 5.8-second autoplay state and is hidden from assistive technology.

- [ ] **Step 4: Reduce the orange navigation weight**

Turn `.signal-tape` into a paper-colored index rail. Use orange for numbers and the active underline, with an ink active item. Keep synchronized manual navigation and horizontal scrolling; do not create an independent marquee.

- [ ] **Step 5: Tighten catalog and finishing sections**

Reduce stacked catalog spacing, cap the catalog title near `90px`, and make filtered results a clean two-column grid with a full-width single result. Shorten reveal motion to roughly `420ms` and `16px`. Reduce the summary to roughly `52svh`, add a readable copy width, and rebuild the footer as a compact two-column top row with a full-width credit row.

- [ ] **Step 6: Keep touch and focus states equivalent**

Wrap hover-only movement in `@media (hover: hover) and (pointer: fine)`, add `:focus-visible` equivalents, use an inset focus ring for the clipped homepage slide, and keep direct-link cues visible on touch devices.

### Task 3: Improve slider and catalog behavior

**Files:**
- Modify: `D:/loadingvibe.com/script.js`
- Test: `D:/loadingvibe.com/.playwright/verify.cjs`

**Interfaces:**
- Consumes: Stable slide IDs, `[data-slider-progress]`, existing autoplay flags, and catalog filter state.
- Produces: Keyboard/swipe navigation, viewport-aware autoplay, progress state, and clean filtered layouts.

- [ ] **Step 1: Add interaction assertions**

In Playwright, focus the carousel region and press `ArrowRight`, `ArrowLeft`, `Home`, and `End`; verify the active slide changes. Dispatch a horizontal touch-style pointer gesture and verify one-step navigation. Assert the progress element is present and active when autoplay is allowed.

- [ ] **Step 2: Implement keyboard and swipe navigation**

Make the carousel region keyboard-focusable. Handle `ArrowLeft`, `ArrowRight`, `Home`, and `End` only when the region itself owns focus. On touch pointers, navigate after a horizontal movement of at least 48px when it is greater than the vertical movement; do not interfere with vertical scrolling.

- [ ] **Step 3: Pause autoplay outside the viewport**

Track carousel visibility with `IntersectionObserver` and include it in `canAutoplay()`. Restart the 5.8-second timer and progress line only while the carousel is visible, the document is visible, reduced motion is off, and the user has not paused or focused the carousel.

- [ ] **Step 4: Reflow filtered results**

Toggle `.is-filtered` and `.has-single-result` on `[data-catalog]` from `applyCatalogState()`. Use these classes to avoid grid gaps after filters/search hide cards.

- [ ] **Step 5: Fix short-brand search aliases**

Add standalone `20` and `vc` tokens to the 20VC card search data. Verify `20`, `VC`, `AI`, `SaaS`, and Chinese keywords return the intended programs without broad two-letter substring matches.

### Task 4: Verify the finished site and regenerate outputs

**Files:**
- Modify: `D:/loadingvibe.com/.playwright/verify.cjs`
- Generated: `D:/loadingvibe.com/public/`
- Generated: `D:/loadingvibe.com/dist/`

**Interfaces:**
- Consumes: All markup, style, interaction, and asset changes from Tasks 1–3.
- Produces: Browser screenshots, a passing verification report, and a deployable Vinext bundle.

- [ ] **Step 1: Run the complete browser suite**

Run: `node .playwright/verify.cjs`

Expected: PASS at 1440×1000, 1081×898, and 390×844 with no console errors, failed requests, missing accessible names, overflow, or broken images.

- [ ] **Step 2: Inspect refreshed screenshots**

Inspect `.playwright/hero.png`, `.playwright/catalog-editorial-1081.png`, `.playwright/catalog-covers-1081.png`, `.playwright/catalog-list-1081.png`, `.playwright/hero-mobile.png`, `.playwright/catalog-mobile.png`, and both footer screenshots. Correct any hierarchy, clipping, contrast, or spacing problem rather than hiding it.

- [ ] **Step 3: Build the production bundle**

Run: `npm.cmd run build`

Expected: `Built Sites-compatible bundle in dist/` with exit code 0.

- [ ] **Step 4: Review the working tree**

Run: `git status --short` and `git diff --check`.

Expected: only the intended source files, optimized cover, generated outputs, screenshots, and planning document are changed; unrelated user files remain untouched.
