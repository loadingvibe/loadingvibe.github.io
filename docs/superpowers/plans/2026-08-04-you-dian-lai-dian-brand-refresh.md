# You Dian Lai Dian Brand Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old “频率加载” identity with “有点来电”, adapt the supplied colorful human-ring symbol into a compact transparent web mark, and give the homepage a more memorable two-line hero title.

**Architecture:** The source-of-truth pages remain `index.html` and `editor.html`, with shared presentation in `styles.css`. A new versioned PNG mark lives beside the existing brand asset; both static HTML and the Vinext metadata reference it. The hero retains the existing grid and photographic background while changing only title copy, typography, alignment, and decorative signal details.

**Tech Stack:** HTML5, CSS, JavaScript, PNG with alpha, Node.js 22, Playwright

## Global Constraints

- Brand text must read exactly `有点来电` in the homepage header, homepage footer, and Markdown editor header.
- Hero title must read exactly `八次来电，打开八个世界` to assistive technology.
- Visible hero lines must be `八次来电` and `打开八个世界`.
- Preserve the existing warm-paper `#f2eee5`, near-black `#11110f`, and signal-orange `#f4511e` system.
- Use blue and yellow from the supplied symbol only as small brand accents.
- Keep every mobile interactive target at least 44 × 44px and prevent horizontal overflow at 390px.
- Preserve all current catalog, slider, filter, search, Markdown editor, and GitHub Pages behavior.
- Do not delete the existing `frequency-loader.svg`; the new asset uses a versioned sibling filename.
- Do not commit or push in this implementation session.

---

### Task 1: Transparent Brand Mark

**Files:**
- Create: `assets/brand/you-dian-lai-dian-mark-v1.png`

**Interfaces:**
- Consumes: the user-supplied colorful painterly symbol with a raised-arm person, circular brush strokes, and sparks.
- Produces: a square alpha PNG with no text and enough padding to remain legible at 32–56px.

- [ ] **Step 1: Generate a chroma-key source from the supplied symbol**

Use the supplied black-canvas artwork only as a visual reference. Generate one centered mark on a perfectly flat `#00ff00` background: raised-arm person, three energetic circular brush arcs, four small sparks, gray/white + orange/yellow + cyan/deep-blue palette, simplified for favicon and navigation use, no text, no shadow, no watermark.

- [ ] **Step 2: Remove the chroma key**

Run the installed image-generation helper with border auto-key, soft matte, and despill, writing the final asset to `assets/brand/you-dian-lai-dian-mark-v1.png`.

- [ ] **Step 3: Validate the asset**

Confirm the final file is PNG RGBA, all four corners have alpha `0`, subject coverage is between 20% and 80% of the canvas, and the mark remains recognizable at 40px.

### Task 2: Brand Copy and Semantic Markup

**Files:**
- Modify: `index.html`
- Modify: `editor.html`
- Modify: `app/layout.jsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `assets/brand/you-dian-lai-dian-mark-v1.png` from Task 1.
- Produces: consistent `有点来电` identity across static and Vinext entry points.

- [ ] **Step 1: Update homepage metadata and header**

Set the document title to `有点来电 — 八次来电，打开八个世界`, update the description to name `有点来电`, point the favicon and wordmark image to the new PNG, and use this exact header label:

```html
<span class="wordmark__name"><span>有点</span><strong>来电</strong></span>
```

- [ ] **Step 2: Update the hero and footer markup**

Use this exact title structure:

```html
<h1 class="hero__title" id="hero-title" aria-label="八次来电，打开八个世界">
  <span class="hero__title-line hero__title-line--loading" data-text="八次来电">八次来电</span>
  <span class="hero__title-line hero__title-line--vibe" data-text="打开八个世界"><span class="hero__title-word">打开</span><span class="hero__title-word hero__title-word--outline">八个世界</span></span>
</h1>
```

Use this exact footer brand structure:

```html
<a class="site-footer__brand-name" href="#top">
  <img class="site-footer__brand-logo" src="assets/brand/you-dian-lai-dian-mark-v1.png" width="56" height="56" alt="">
  <span>有点来电</span>
</a>
```

- [ ] **Step 3: Update the editor and Vinext metadata**

Apply the same mark and `有点来电` wordmark to `editor.html`; update `app/layout.jsx` title, description, and icon path to match the static page.

- [ ] **Step 4: Update project-facing brand copy**

Change the README heading and opening product name from `频率加载` to `有点来电`, without rewriting unrelated documentation.

### Task 3: Responsive Brand and Hero Styling

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Consumes: the markup classes retained in Task 2.
- Produces: white-header and dark-footer wordmarks plus a desktop/mobile title treatment.

- [ ] **Step 1: Refine the header wordmark**

Set the mark to 40px desktop and 32px mobile, use the shared sans font at `700`, color `来电` with `var(--signal)`, and preserve a combined 44px minimum hit area.

- [ ] **Step 2: Art-direct the hero title**

Keep the first line left-aligned and solid with an orange offset stroke; align the second line right, color `打开` warm white, outline `八个世界`, retain the skewed signal underline, and use balanced wrapping plus a restrained reveal motion already covered by `prefers-reduced-motion`.

- [ ] **Step 3: Make the footer brand a lockup**

Display the 56px mark and `有点来电` on one baseline-aligned row; reduce to 48px on mobile while preserving the existing footer grid and legal note.

- [ ] **Step 4: Guard small screens**

At `max-width: 760px`, size the six-character second line with `clamp(52px, 15.2vw, 76px)`, keep both lines left-aligned, and ensure the title width never exceeds `100%`.

### Task 4: Build and Browser Verification

**Files:**
- Verify: `index.html`
- Verify: `editor.html`
- Verify: `_site/index.html`

**Interfaces:**
- Consumes: all changes from Tasks 1–3.
- Produces: validated source and deployable Pages artifact.

- [ ] **Step 1: Run syntax and build checks**

Run `npm.cmd run check:syntax`, `npm.cmd run build:pages`, `npm.cmd run check:pages`, and `npm.cmd run build`.

Expected: all commands exit `0`.

- [ ] **Step 2: Verify desktop and mobile browsers**

Load the homepage at 1440 × 1000, 995 × 898, and 390 × 844. Confirm the new mark loads, `有点来电` appears in header/footer, the title fits without clipping, all 8 cards remain present, and horizontal overflow is `0`.

- [ ] **Step 3: Verify the writing page**

Load `editor.html` at 1440 × 1000 and 390 × 844. Confirm the new wordmark loads, Markdown input and preview remain usable, and console/page/request error arrays are empty.

## Self-Review

- Spec coverage: supplied logo, new brand name, artistic hero title, header, footer, editor consistency, and responsive verification are covered.
- Placeholder scan: no deferred implementation markers remain.
- Interface consistency: `you-dian-lai-dian-mark-v1.png`, `有点来电`, and `八次来电，打开八个世界` are identical across tasks.
