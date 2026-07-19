# Loading Vibe Static Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, original static podcast-curation website from the eight supplied references and program descriptions.

**Architecture:** The site is a framework-free HTML/CSS/JavaScript artifact. Semantic HTML contains all show content so it remains usable without JavaScript; CSS provides the editorial system and three layout modes; JavaScript progressively adds filtering, search, view persistence, and restrained motion.

**Tech Stack:** HTML5, modern CSS, vanilla JavaScript, local JPEG/PNG artwork, Playwright for browser verification.

## Global Constraints

- The deliverable must remain a static site with no runtime framework or remote font dependency.
- All eight supplied shows must appear with their provided descriptions and original outbound source links.
- The visual result must synthesize reference patterns without recreating a copyrighted interface or brand.
- Mobile interaction targets must be at least 44 × 44px.
- All motion must respect `prefers-reduced-motion`.

---

## File Structure

- `index.html` — semantic page structure, show content, controls, and metadata.
- `styles.css` — design tokens, responsive layouts, three catalog view modes, states, and motion.
- `script.js` — progressive search/filter/view behavior and local preference persistence.
- `assets/covers/*` — verified official artwork for the eight referenced shows.
- `README.md` — preview instructions, design rationale, and content-update guidance.
- `product-facts.md` — dated reference-page and asset provenance facts.
- `docs/design-reference-analysis.md` — extracted patterns and the selected visual direction.

### Task 1: Build the semantic content shell

**Files:**
- Create: `index.html`

**Interfaces:**
- Consumes: the eight supplied program names, descriptions, source URLs, and `assets/covers/*`.
- Produces: `.show-card[data-category][data-language][data-search]`, `[data-filter]`, `[data-view]`, and `#show-search` hooks used by styling and JavaScript.

- [x] **Step 1: Add the document metadata and no-JS-safe structure**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Loading Vibe — 值得听完的长谈</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main>
    <section id="shows" aria-labelledby="shows-title"></section>
  </main>
  <script src="script.js" defer></script>
</body>
</html>
```

- [x] **Step 2: Add eight complete show articles**

Each article must use this exact interface and real content, repeated for all eight shows:

```html
<article class="show-card" data-category="科技" data-language="EN" data-search="dwarkesh podcast 人工智能 科学 历史">
  <a class="show-card__link" href="https://www.dwarkesh.com/p/grant-sanderson-2" target="_blank" rel="noreferrer">
    <img src="assets/covers/dwarkesh.jpg" alt="Dwarkesh Podcast 节目封面" width="1200" height="1200">
    <h3>Dwarkesh Podcast</h3>
  </a>
</article>
```

- [x] **Step 3: Validate the content shell**

Run: open `index.html` and confirm all eight `<article class="show-card">` nodes are present without JavaScript.
Expected: eight visible, linked shows with meaningful image alt text.

### Task 2: Implement the visual system and three layouts

**Files:**
- Create: `styles.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: semantic classes and `data-view-mode` on `<body>`.
- Produces: `editorial`, `covers`, and `list` layout modes.

- [x] **Step 1: Declare immutable design tokens**

```css
:root {
  --paper: #f2eee5;
  --ink: #11110f;
  --signal: #f4511e;
  --muted: #79766f;
  --line: color-mix(in srgb, var(--ink) 18%, transparent);
  --space-3: 24px;
  --space-6: 48px;
  --space-9: 72px;
}
```

- [x] **Step 2: Add the editorial grid, cover wall, and compact list**

```css
body[data-view-mode="editorial"] .catalog { display: grid; grid-template-columns: repeat(12, 1fr); }
body[data-view-mode="covers"] .catalog { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
body[data-view-mode="list"] .show-card { display: grid; grid-template-columns: 88px 1fr auto; }
```

- [x] **Step 3: Add responsive and reduced-motion rules**

```css
@media (max-width: 760px) {
  .catalog { grid-template-columns: 1fr !important; }
  .control { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; }
}
```

- [x] **Step 4: Verify desktop and mobile composition**

Run: load at 1440×1000 and 390×844.
Expected: no horizontal overflow, readable text, square covers, and reachable controls.

### Task 3: Add progressive catalog interactions

**Files:**
- Create: `script.js`

**Interfaces:**
- Consumes: `[data-filter]`, `[data-view]`, `#show-search`, and `.show-card`.
- Produces: active-control states, hidden-card states, result count, and `loading-vibe-view` localStorage preference.

- [x] **Step 1: Implement combined filtering and search**

```js
const state = { filter: "全部", query: "" };
function applyCatalogState() {
  cards.forEach((card) => {
    const categoryMatch = state.filter === "全部" || card.dataset.category.includes(state.filter);
    const searchMatch = card.dataset.search.toLowerCase().includes(state.query);
    card.hidden = !(categoryMatch && searchMatch);
  });
}
```

- [x] **Step 2: Implement the three view modes**

```js
function setView(mode) {
  document.body.dataset.viewMode = mode;
  localStorage.setItem("loading-vibe-view", mode);
}
```

- [x] **Step 3: Add keyboard-visible states and optional reveal motion**

Use `IntersectionObserver` only when reduced motion is not requested; the page must remain fully visible when the API is unavailable.

- [x] **Step 4: Exercise the primary interaction flow**

Expected sequence: choose “商业” → type “AI” → clear search → switch to “列表” → reload → list view remains active.

### Task 4: Document and verify the finished artifact

**Files:**
- Create: `README.md`
- Verify: `index.html`, `styles.css`, `script.js`, `assets/covers/*`

**Interfaces:**
- Consumes: the completed static artifact.
- Produces: reproducible preview instructions and a browser QA record.

- [x] **Step 1: Add preview and content-update instructions**

```markdown
python -m http.server 4173
# Open http://127.0.0.1:4173
```

- [x] **Step 2: Run a local HTTP server**

Run: `python -m http.server 4173`
Expected: server listens on `127.0.0.1:4173`.

- [x] **Step 3: Run browser checks**

Expected: clean console, no failed local resources, eight cards, three view buttons, working category/search flow, and no overflow at 390px.

- [x] **Step 4: Review the final screenshot**

Expected: the selected editorial/media/library synthesis is visually coherent and the mobile layout retains the content hierarchy.
