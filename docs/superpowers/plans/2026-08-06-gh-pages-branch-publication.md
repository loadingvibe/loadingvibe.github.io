# GitHub Pages Branch Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the existing successful GitHub Pages deployment and also publish the verified static site to a real `gh-pages` branch after every `main` build.

**Architecture:** The existing Node.js build remains the single source of deployable files in `_site/`. The workflow will grant only the additional repository-content permission it needs, create an isolated orphan Git repository from `_site/`, and force-update `gh-pages` without committing generated files to `main`; the existing Pages artifact deployment remains intact so current hosting is not interrupted.

**Tech Stack:** GitHub Actions, Bash, Git, Node.js 22, GitHub Pages

## Global Constraints

- Preserve `main` as the source branch and trigger builds only from `main` or `workflow_dispatch`.
- Publish only `_site/`, including `.nojekyll`; never publish source files, `.git`, dependencies, or build tooling.
- Keep the current artifact-based GitHub Pages deployment working.
- Use the workflow-scoped `GITHUB_TOKEN`; add no personal access token or third-party deployment action.
- Do not force-push `main`; only the generated `gh-pages` branch may be replaced.

---

### Task 1: Publish the Built Site Branch

**Files:**
- Modify: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: the verified `_site/` directory produced by `npm run build:pages`.
- Produces: an orphan `gh-pages` branch containing the exact `_site/` tree.

- [ ] **Step 1: Grant branch publication permission**

Change the workflow permission from `contents: read` to `contents: write`, while retaining `pages: write` and `id-token: write` for the existing Pages deployment.

- [ ] **Step 2: Publish `_site/` after the smoke test**

Add a Bash step that copies `_site/.` into `mktemp -d`, initializes an orphan repository on `gh-pages`, commits with the GitHub Actions bot identity, and force-pushes only that branch using `${{ secrets.GITHUB_TOKEN }}` and `${GITHUB_REPOSITORY}`.

- [ ] **Step 3: Verify build and workflow contracts**

Run:

```powershell
npm.cmd run check:syntax
npm.cmd run build:pages
npm.cmd run check:pages
```

Expected: all commands exit `0`; `_site/.nojekyll` exists; the workflow retains its `main` trigger and Pages deploy job, grants `contents: write`, and contains a push targeting only `gh-pages`.

## Self-Review

- Spec coverage: the plan creates the missing branch without replacing the already successful Pages deployment.
- Placeholder scan: there are no deferred implementation markers.
- Interface consistency: the build, smoke test, branch publication, and Pages artifact upload all consume the same `_site/` output.
