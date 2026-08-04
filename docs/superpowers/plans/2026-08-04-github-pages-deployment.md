# GitHub Pages Automated Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the existing static homepage and Markdown editor into a clean GitHub Pages artifact and deploy it automatically after every push to `main` or a manual workflow run.

**Architecture:** Keep `index.html`, `editor.html`, their CSS/JavaScript, and `assets/` as the source of truth. A dependency-free Node.js packager creates an isolated `_site/` directory, validates every required source and output, and writes `.nojekyll`; a two-job GitHub Actions workflow uploads that directory as the Pages artifact, then deploys it through the protected `github-pages` environment.

**Tech Stack:** Node.js 22, npm, GitHub Actions, GitHub Pages, HTML/CSS/JavaScript

## Global Constraints

- Preserve the existing Vinext `npm run build` path and all page content.
- Use only Node.js built-ins for the Pages packager; add no runtime dependency.
- Publish only the curated `_site/` directory, never the repository root, `.git`, drafts, or build tooling.
- Keep all deployed links relative so the output works for both user and project Pages URLs.
- Trigger production deployment only from `main` and `workflow_dispatch`.
- Do not commit, push, or change repository settings in this implementation session.

---

## File Structure

- Create `build-pages.mjs`: owns the deterministic static artifact build and post-copy validation.
- Create `.github/workflows/deploy-pages.yml`: owns CI installation, artifact build/upload, and Pages deployment.
- Modify `package.json`: exposes `npm run build:pages` without changing `npm run build`.
- Modify `.gitignore`: excludes generated `_site/` output.
- Modify `README.md`: documents local artifact generation and the one-time Pages source setting.

### Task 1: Static Pages Artifact Builder

**Files:**
- Create: `build-pages.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: repository-root files `index.html`, `editor.html`, `styles.css`, `script.js`, `editor.css`, `editor.js`, and directory `assets/`.
- Produces: `_site/` with the same public paths, `_site/.nojekyll`, and optional `_site/CNAME` when a root `CNAME` exists.

- [ ] **Step 1: Add the package command and expected ignored output**

Add `"build:pages": "node build-pages.mjs"` to `scripts` and add `_site/` to `.gitignore`.

- [ ] **Step 2: Confirm the new command fails before implementation**

Run: `npm run build:pages`

Expected: non-zero exit with Node reporting that `build-pages.mjs` is missing.

- [ ] **Step 3: Implement the dependency-free packager**

Create `build-pages.mjs` with these exact behaviors:

```js
import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, "_site");
const requiredFiles = [
  "index.html",
  "editor.html",
  "styles.css",
  "script.js",
  "editor.css",
  "editor.js",
];
const requiredDirectories = ["assets"];

if (dirname(output) !== root || relative(root, output) !== "_site") {
  throw new Error("Refusing to build outside the project root.");
}

for (const filename of requiredFiles) {
  const source = resolve(root, filename);
  if (!existsSync(source) || !statSync(source).isFile()) {
    throw new Error(`Missing required file: ${filename}`);
  }
}

for (const directory of requiredDirectories) {
  const source = resolve(root, directory);
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    throw new Error(`Missing required directory: ${directory}`);
  }
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const filename of requiredFiles) {
  copyFileSync(resolve(root, filename), resolve(output, filename));
}

for (const directory of requiredDirectories) {
  cpSync(resolve(root, directory), resolve(output, directory), {
    recursive: true,
  });
}

const customDomain = resolve(root, "CNAME");
if (existsSync(customDomain) && statSync(customDomain).isFile()) {
  copyFileSync(customDomain, resolve(output, "CNAME"));
}

writeFileSync(resolve(output, ".nojekyll"), "", "utf8");

for (const filename of [...requiredFiles, ".nojekyll"]) {
  const builtFile = resolve(output, filename);
  if (!existsSync(builtFile) || !statSync(builtFile).isFile()) {
    throw new Error(`Pages artifact is incomplete: ${filename}`);
  }
}

if (!statSync(resolve(output, "assets")).isDirectory()) {
  throw new Error("Pages artifact is incomplete: assets");
}

process.stdout.write("Built GitHub Pages artifact in _site/\n");
```

- [ ] **Step 4: Build twice to verify clean, deterministic regeneration**

Run: `npm run build:pages && npm run build:pages`

Expected: both runs exit `0` and print `Built GitHub Pages artifact in _site/`.

### Task 2: Pages Workflow

**Files:**
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: package script `build:pages` and `_site/` from Task 1.
- Produces: artifact named `github-pages` and a deployment URL at `steps.deployment.outputs.page_url`.

- [ ] **Step 1: Add build and deploy jobs**

Create `.github/workflows/deploy-pages.yml` with the following structure:

```yaml
name: Build and deploy GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v7
      - name: Set up Node.js
        uses: actions/setup-node@v7
        with:
          node-version: 22
          package-manager-cache: false
      - name: Build Pages artifact
        run: npm run build:pages
      - name: Configure GitHub Pages
        uses: actions/configure-pages@v6
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: ./_site
          include-hidden-files: true

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: Validate the workflow contract locally**

Check that the workflow contains `push.branches: [main]`, `workflow_dispatch`, `pages: write`, `id-token: write`, `needs: build`, `environment.name: github-pages`, and `path: ./_site`.

Expected: every required key appears once and the file parses as YAML 1.2.

### Task 3: Documentation and End-to-End Verification

**Files:**
- Modify: `README.md`
- Verify: `_site/index.html`, `_site/editor.html`, `_site/assets/brand/frequency-loader.svg`

**Interfaces:**
- Consumes: the package command and workflow defined in Tasks 1–2.
- Produces: operator instructions for local builds and first-time repository configuration.

- [ ] **Step 1: Document local and automatic deployment**

Document `npm run build:pages`, `_site/`, push/manual triggers, and the one-time GitHub setting `Settings → Pages → Build and deployment → Source: GitHub Actions`. State that a root `CNAME` is copied when present but the custom domain must still be configured in repository settings.

- [ ] **Step 2: Verify the artifact over HTTP**

Run `npm run build:pages`, serve `_site/` on localhost, and request `/`, `/editor.html`, `/styles.css`, `/script.js`, and `/assets/brand/frequency-loader.svg`.

Expected: every request returns HTTP `200`, the homepage includes the site header, and the editor includes the Markdown input.

- [ ] **Step 3: Run the existing production build**

Run: `npm run build`

Expected: exit `0`, `dist/server/index.js` exists, and the existing Vinext deployment path remains intact.

## Self-Review

- Spec coverage: automatic build, Pages artifact upload, deployment, manual retry, and operator documentation are covered.
- Placeholder scan: no deferred implementation markers remain.
- Interface consistency: `_site` is identical in the package command, workflow upload path, ignore rule, and documentation.
