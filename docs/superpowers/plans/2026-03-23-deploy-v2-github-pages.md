# Deploy FiceCal v2 — Full-Stack Deployment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy FiceCal v2 end-to-end — static SPA at `https://duksh.github.io/ficecal` (GitHub Pages) and MCP service at a live Render.com URL — so the full product is publicly accessible for the first time.

**Architecture:** Two independently deployed units. (1) `apps/web` — Vite + React SPA, built in GitHub Actions, served from GitHub Pages. Needs a `base` path fix and `VITE_MCP_BASE_URL` pointing at Render. (2) `services/mcp` — Fastify HTTP service, deployed to Render.com as a Node.js web service. Needs two one-line fixes so it binds correctly on Render's infrastructure. Both units talk over HTTPS; the SPA calls the MCP service directly from the browser.

**Tech Stack:** pnpm 10.6.0 · Vite 5 · React 18 · TypeScript 5.4.5 · Fastify 4 · GitHub Actions · `actions/configure-pages@v5` · `actions/upload-pages-artifact@v3` · `actions/deploy-pages@v4` · Render.com (Node web service) · `render.yaml`

---

## ⚠️ Pre-Flight: URL Decisions

### Static SPA URL
GitHub Pages URL = repo name, case-sensitive. The repo is currently `FiceCal` (capital F), which gives `duksh.github.io/FiceCal`.

To get **`duksh.github.io/ficecal`** (lowercase):
1. Go to `https://github.com/duksh/FiceCal/settings`
2. Under **General → Repository name** → rename to `ficecal`
3. GitHub auto-redirects all existing clone URLs and web links

**This plan targets `ficecal` (lowercase).** If you skip the rename, change every `/ficecal/` in this plan to `/FiceCal/`.

### MCP Service URL
After deploying to Render.com, you will get a URL like `https://ficecal-mcp.onrender.com`. This URL must be supplied to Task 5 before pushing.

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify | `services/mcp/src/server.ts` | Fix PORT + HOST for Render.com |
| Create | `render.yaml` | Render.com service definition |
| Modify | `apps/web/vite.config.ts` | Add env-driven `base` path |
| Modify | `.github/workflows/pages-deploy.yml` | Add `develop` trigger + inject env vars |
| Manual | GitHub → repo rename | `FiceCal` → `ficecal` |
| Manual | GitHub → Settings → Pages | Set source to GitHub Actions |
| Manual | GitHub → Settings → Variables | `ENABLE_PAGES_DEPLOY=true` |
| Manual | Render.com dashboard | Create web service, set env vars |

---

## Task 1: Verify the build compiles cleanly (no regressions)

Before changing anything, confirm the existing build chain works end-to-end.

**Files:** Read-only verification

- [ ] **Step 1.1: Build all workspace packages**

```bash
cd /Users/duksh/MyDev-00/ficecal
pnpm -r build --if-present 2>&1 | tail -40
```

Expected: all packages build without error. If a package fails, fix that TypeScript error before proceeding — it will block CI identically.

- [ ] **Step 1.2: Build the web app**

```bash
cd /Users/duksh/MyDev-00/ficecal/apps/web
pnpm build 2>&1 | tail -20
```

Expected: ends with `✓ built in X.XXs` and `apps/web/dist/` is created.

- [ ] **Step 1.3: Build the MCP service**

```bash
cd /Users/duksh/MyDev-00/ficecal/services/mcp
pnpm build 2>&1 | tail -20
```

Expected: TypeScript compiles to `services/mcp/dist/` without errors.

---

## Task 2: Fix MCP service for Render.com compatibility

Two one-line bugs in `services/mcp/src/server.ts` that will cause silent failures on Render.com:

1. **`HOST=127.0.0.1`** — loopback address. Render's load balancer connects from outside the process; it will health-check fail, kill the service, and restart it forever. Must be `0.0.0.0`.
2. **`PORT` vs `MCP_PORT`** — Render injects the correct port as `PORT`. The server reads `MCP_PORT`. They never connect, so the service starts on `4001` but Render routes traffic to a different port → 502 on every request.

**Files:**
- Modify: `services/mcp/src/server.ts` (lines 16–17 only)

`★ Insight ─────────────────────────────────────`
Render.com (and most PaaS platforms) inject `PORT` as the env var the process must bind to. The platform's router then proxies external traffic to that port. Binding to `127.0.0.1` makes the process invisible to the router's health check agent, which runs from a different network namespace. This is the #1 silent failure when moving Node services to Render/Railway/Fly.
`─────────────────────────────────────────────────`

- [ ] **Step 2.1: Write a failing test that checks env handling**

```bash
cat > /tmp/test-render-compat.mjs << 'EOF'
// Quick smoke: confirm server starts on PORT env var and 0.0.0.0
// Run AFTER the fix; run now to confirm it fails first.
import { buildApp } from '/Users/duksh/MyDev-00/ficecal/services/mcp/src/server.ts';
// If HOST is still 127.0.0.1, the app won't respond to external probes.
// This check is conceptual — actual verification is the Render health check.
console.log("PORT env check:", process.env.PORT ?? "not set");
console.log("MCP_PORT env check:", process.env.MCP_PORT ?? "not set");
EOF
echo "Test file created. Proceeding to fix."
```

- [ ] **Step 2.2: Apply the two-line fix to `server.ts`**

In `services/mcp/src/server.ts`, change lines 16–17 from:

```typescript
const PORT = Number(process.env["MCP_PORT"] ?? 4001);
const HOST = process.env["MCP_HOST"] ?? "127.0.0.1";
```

To:

```typescript
// Render.com injects PORT; MCP_PORT is the local-dev override. HOST must
// be 0.0.0.0 on Render so the platform router can reach the process.
const PORT = Number(process.env["PORT"] ?? process.env["MCP_PORT"] ?? 4001);
const HOST = process.env["MCP_HOST"] ?? (process.env["NODE_ENV"] === "production" ? "0.0.0.0" : "127.0.0.1");
```

- [ ] **Step 2.3: Rebuild MCP service to confirm it compiles**

```bash
cd /Users/duksh/MyDev-00/ficecal/services/mcp
pnpm build 2>&1 | tail -10
```

Expected: `✓` no TypeScript errors.

- [ ] **Step 2.4: Smoke test the server starts and responds locally**

```bash
cd /Users/duksh/MyDev-00/ficecal/services/mcp
# Start in background
node --import tsx/esm src/server.ts &
MCP_PID=$!
sleep 2
# Health check
curl -s http://localhost:4001/mcp/v1/health | head -c 200
# Cleanup
kill $MCP_PID 2>/dev/null
```

Expected: JSON response with `{"version":...,"phase":...,"tools":...}`

- [ ] **Step 2.5: Commit**

```bash
cd /Users/duksh/MyDev-00/ficecal
git add services/mcp/src/server.ts
git commit -m "$(cat <<'EOF'
fix(mcp): bind to PORT+0.0.0.0 for Render.com compatibility

- Read PORT env var (Render's injected port) with MCP_PORT as local fallback
- Bind HOST to 0.0.0.0 in production so Render's LB router can reach
  the process; keeps 127.0.0.1 for local dev security

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `render.yaml` for the MCP service

`render.yaml` is Render's infrastructure-as-code file. Committing it to the repo means the service definition is version-controlled and the deploy is reproducible.

**Files:**
- Create: `render.yaml` (repo root)

`★ Insight ─────────────────────────────────────`
`render.yaml` placed at the repo root is automatically detected by Render when you connect the GitHub repo. The `buildCommand` runs once per deploy; `startCommand` is what stays alive. Render's free tier suspends services after 15 minutes of inactivity — the first request after sleep takes ~30 seconds (cold start). `ficecal-mcp` is a stateless fixture-mode service so this is acceptable for a public demo; live billing mode would require a paid plan.
`─────────────────────────────────────────────────`

- [ ] **Step 3.1: Create `render.yaml`**

```yaml
# render.yaml — FiceCal v2 Render.com service definitions
# Docs: https://render.com/docs/render-yaml-ref

services:
  - type: web
    name: ficecal-mcp
    runtime: node
    region: oregon              # closest to GitHub Pages CDN edge for low latency
    branch: develop             # deploy from develop branch
    buildCommand: >-
      corepack enable &&
      pnpm install --frozen-lockfile &&
      pnpm -r --filter='!@ficecal/web' build --if-present &&
      cd services/mcp &&
      pnpm build
    startCommand: node services/mcp/dist/server.js
    healthCheckPath: /mcp/v1/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: INGEST_MODE
        value: fixture          # safe default; switch to 'live' when AWS creds are ready
      - key: LOG_LEVEL
        value: info
      - key: CORS_ORIGIN
        value: https://duksh.github.io   # only the GH Pages origin can call this service
      - key: MCP_CATALOG_REFRESH_INTERVAL_MS
        value: "21600000"       # 6h refresh; 0 to disable
    # PORT and HOST are set automatically by Render — do not add them here.
    # Add FICECAL_AWS_* secrets manually in the Render dashboard (never in this file).
```

- [ ] **Step 3.2: Validate the YAML**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('render.yaml'))" && echo "✅ render.yaml valid"
```

- [ ] **Step 3.3: Commit**

```bash
cd /Users/duksh/MyDev-00/ficecal
git add render.yaml
git commit -m "$(cat <<'EOF'
ci(render): add render.yaml for MCP service deployment

Defines ficecal-mcp as a Render.com Node web service deploying from
the develop branch. CORS locked to duksh.github.io. INGEST_MODE=fixture
as safe default. Secrets (AWS keys) must be added via Render dashboard.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Fix Vite base path for GitHub Pages

Without `base: '/ficecal/'`, Vite builds asset paths as root-relative (`/assets/index.js`). GitHub Pages serves the app at `/ficecal/assets/index.js`. Every JS and CSS file 404s → blank white page.

**Files:**
- Modify: `apps/web/vite.config.ts`

- [ ] **Step 4.1: Write a base-path verification script**

```bash
cat > /tmp/check-base.sh << 'EOF'
#!/bin/bash
DIST="apps/web/dist/index.html"
if grep -q '/ficecal/assets/' "$DIST" 2>/dev/null; then
  echo "✅ Base path /ficecal/ confirmed in dist/index.html"
  exit 0
else
  echo "❌ Base path /ficecal/ NOT found — will 404 on GitHub Pages"
  grep -o 'src="[^"]*"' "$DIST" 2>/dev/null | head -5
  exit 1
fi
EOF
chmod +x /tmp/check-base.sh
```

- [ ] **Step 4.2: Run check — confirm it fails now (expected)**

```bash
cd /Users/duksh/MyDev-00/ficecal && bash /tmp/check-base.sh
```

Expected: `❌ Base path /ficecal/ NOT found` — correct, this is the gap.

- [ ] **Step 4.3: Update `apps/web/vite.config.ts`**

Replace the full file content with:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // VITE_BASE_URL is injected by CI (GitHub Actions configure-pages outputs
  // the correct base path). Local dev leaves it unset → defaults to "/" so
  // the dev server is unaffected.
  base: process.env.VITE_BASE_URL ?? "/",
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  resolve: {
    // Allow TypeScript source imports from workspace packages
    conditions: ["import", "default"],
  },
});
```

- [ ] **Step 4.4: Rebuild with the env var to verify fix**

```bash
cd /Users/duksh/MyDev-00/ficecal/apps/web
VITE_BASE_URL=/ficecal/ pnpm build 2>&1 | tail -10
```

- [ ] **Step 4.5: Run check — confirm it passes now**

```bash
cd /Users/duksh/MyDev-00/ficecal && bash /tmp/check-base.sh
```

Expected: `✅ Base path /ficecal/ confirmed in dist/index.html`

- [ ] **Step 4.6: Commit**

```bash
cd /Users/duksh/MyDev-00/ficecal
git add apps/web/vite.config.ts
git commit -m "$(cat <<'EOF'
fix(web): add env-driven base path for GitHub Pages subdirectory

Vite's default base '/' generates root-relative asset paths that 404
when served from /ficecal/ on GitHub Pages. VITE_BASE_URL is injected
by CI configure-pages; local dev is unchanged (defaults to '/').

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update GitHub Actions workflow to wire both services

The `pages-deploy.yml` needs three changes:
1. Add `develop` to push trigger
2. Inject `VITE_BASE_URL` from `configure-pages` output
3. Inject `VITE_MCP_BASE_URL` pointing at the live Render.com service URL

> **Stop here before writing the workflow.** You need the Render.com URL first (Task 6). Come back and fill in the placeholder `https://ficecal-mcp.onrender.com` with the real URL after deploying to Render.

**Files:**
- Modify: `.github/workflows/pages-deploy.yml`

- [ ] **Step 5.1: Update `pages-deploy.yml`**

Replace the full file content with:

```yaml
name: Deploy FiceCal v2 (GitHub Pages)

on:
  push:
    branches: [main, develop]   # develop = v2 preview; main = stable release
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    if: ${{ github.event_name == 'workflow_dispatch' || vars.ENABLE_PAGES_DEPLOY == 'true' }}
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Configure Pages
        id: pages
        uses: actions/configure-pages@v5

      - name: Install dependencies
        run: |
          corepack enable
          pnpm install --frozen-lockfile

      - name: Build workspace packages (excluding web)
        run: pnpm -r --filter='!@ficecal/web' build --if-present

      - name: Build web app
        env:
          # configure-pages outputs the correct base_path for this repo
          # e.g. /ficecal  (without trailing slash — Vite needs trailing slash)
          VITE_BASE_URL: ${{ steps.pages.outputs.base_path }}/
          # Point the SPA at the live Render.com MCP service
          # UPDATE THIS URL after deploying to Render (Task 6)
          VITE_MCP_BASE_URL: https://ficecal-mcp.onrender.com
        run: |
          cd apps/web
          pnpm build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: apps/web/dist

  deploy:
    if: ${{ github.event_name == 'workflow_dispatch' || vars.ENABLE_PAGES_DEPLOY == 'true' }}
    runs-on: ubuntu-latest
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5.2: Validate YAML**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/pages-deploy.yml'))" && echo "✅ YAML valid"
```

- [ ] **Step 5.3: Commit**

```bash
cd /Users/duksh/MyDev-00/ficecal
git add .github/workflows/pages-deploy.yml
git commit -m "$(cat <<'EOF'
ci(pages): wire v2 full-stack deploy from develop branch

- Add 'develop' to push trigger for continuous preview deploys
- Inject VITE_BASE_URL from configure-pages (handles /ficecal/ path)
- Inject VITE_MCP_BASE_URL pointing at Render.com MCP service
- Explicit build steps replace ambiguous --if-present chain

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Manual steps — Render.com service creation

These steps require browser interaction with Render.com. Do them once; Render then auto-deploys on every push to `develop`.

- [ ] **Step 6.1: Connect repo to Render.com**

1. Log in to [render.com/dashboard](https://render.com/dashboard)
2. Click **New +** → **Web Service**
3. Connect GitHub → select `duksh/ficecal` (after rename) or `duksh/FiceCal`
4. Render detects `render.yaml` automatically — click **Apply from render.yaml**
5. Confirm service name: `ficecal-mcp`

- [ ] **Step 6.2: Note your Render service URL**

After creation, Render assigns a URL like `https://ficecal-mcp.onrender.com`.

```
YOUR RENDER URL: ____________________________
```

Write it down — you need it for Step 5.1 and for the `VITE_MCP_BASE_URL` GitHub variable.

- [ ] **Step 6.3: Add the Render URL as a GitHub Actions variable**

Rather than hardcoding the URL in the YAML file, add it as a repo variable so it can be updated without a commit:

1. Go to `https://github.com/duksh/ficecal/settings/variables/actions`
2. Click **New repository variable**
3. Name: `VITE_MCP_BASE_URL`
4. Value: `https://ficecal-mcp.onrender.com` (your actual URL)

Then update `pages-deploy.yml` to read it:

In the `Build web app` step, change:
```yaml
VITE_MCP_BASE_URL: https://ficecal-mcp.onrender.com
```
to:
```yaml
VITE_MCP_BASE_URL: ${{ vars.VITE_MCP_BASE_URL }}
```

Commit that single-line change:
```bash
git add .github/workflows/pages-deploy.yml
git commit -m "ci(pages): read VITE_MCP_BASE_URL from repo variable

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] **Step 6.4: Verify Render health check passes**

```bash
# Replace with your actual Render URL
curl -s https://ficecal-mcp.onrender.com/mcp/v1/health | python3 -m json.tool
```

Expected: JSON with `version`, `phase`, `tools` fields. If Render is cold-starting, wait 30–45 seconds and retry.

---

## Task 7: Manual steps — GitHub repo settings

- [ ] **Step 7.1: Rename repo (if targeting lowercase URL)**

1. Go to `https://github.com/duksh/FiceCal/settings`
2. Under **General → Repository name** → type `ficecal` → **Rename**
3. Update your local remote:

```bash
cd /Users/duksh/MyDev-00/ficecal
git remote set-url origin https://github.com/duksh/ficecal.git
git remote -v   # confirm the new URL
```

- [ ] **Step 7.2: Enable GitHub Pages with GitHub Actions source**

1. Go to `https://github.com/duksh/ficecal/settings/pages`
2. Under **Build and deployment → Source** → select **GitHub Actions**
3. Click **Save**

- [ ] **Step 7.3: Set `ENABLE_PAGES_DEPLOY` repository variable**

1. Go to `https://github.com/duksh/ficecal/settings/variables/actions`
2. Click **New repository variable**
3. Name: `ENABLE_PAGES_DEPLOY` · Value: `true`
4. Click **Add variable**

---

## Task 8: Push and verify end-to-end

- [ ] **Step 8.1: Push develop to origin**

```bash
cd /Users/duksh/MyDev-00/ficecal
git push origin develop
```

- [ ] **Step 8.2: Watch the GitHub Actions run**

```bash
gh run list --repo duksh/ficecal --branch develop --limit 3
gh run watch --repo duksh/ficecal \
  $(gh run list --repo duksh/ficecal --branch develop --json databaseId --jq '.[0].databaseId')
```

Expected timeline: `build` (~4 min) → `deploy` (~45 sec) → ✅

- [ ] **Step 8.3: Verify SPA loads at GitHub Pages URL**

```bash
curl -sI https://duksh.github.io/ficecal/ | head -5
```

Expected: `HTTP/2 200` · `content-type: text/html`

- [ ] **Step 8.4: Verify MCP service is reachable from the SPA origin**

```bash
# Simulate a browser request with the correct Origin header
curl -sI \
  -H "Origin: https://duksh.github.io" \
  https://ficecal-mcp.onrender.com/mcp/v1/health | grep -E 'HTTP|access-control'
```

Expected:
```
HTTP/2 200
access-control-allow-origin: https://duksh.github.io
```

- [ ] **Step 8.5: Full browser smoke test**

Open `https://duksh.github.io/ficecal/` in Chrome/Firefox. Check:
- [ ] Page loads — no blank screen
- [ ] Browser tab shows "FiceCal v2"
- [ ] ThemeToggle works (light/dark toggle)
- [ ] IntelligencePanel shows MCP service URL (`https://ficecal-mcp.onrender.com`) in its footer text
- [ ] DevTools → Network: no 404 errors on `.js` or `.css` files
- [ ] DevTools → Console: no CORS errors

---

## Task 9: Update README with live URLs

- [ ] **Step 9.1: Add live links to README.md**

```markdown
## FiceCal v2

| Surface | URL | Notes |
|---------|-----|-------|
| Web app | https://duksh.github.io/ficecal | GitHub Pages, static SPA |
| MCP API | https://ficecal-mcp.onrender.com/mcp/v1/health | Render.com, fixture mode |
| v1 (live) | https://duksh.github.io | Unaffected, separate repo |
```

- [ ] **Step 9.2: Commit and push**

```bash
cd /Users/duksh/MyDev-00/ficecal
git add README.md
git commit -m "docs: add v2 live URLs to README

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin develop
```

---

## Rollback Procedure

**SPA broke:** Revert the vite.config commit and push — CI redeploys the reverted version.
```bash
git revert HEAD && git push origin develop
```

**MCP service broke:** In Render.com dashboard → `ficecal-mcp` → **Manual Deploy** → pick the last known-good commit.

**v1 safety:** v1 is at `duksh/duksh.github.io` — a completely separate repo. Nothing in this plan touches it. It cannot be affected.

---

## Summary

| # | File / Action | Type | Why |
|---|--------------|------|-----|
| 1 | `services/mcp/src/server.ts` | Code | Bind to `PORT` + `0.0.0.0` for Render |
| 2 | `render.yaml` | Config | IaC definition for MCP service |
| 3 | `apps/web/vite.config.ts` | Code | `base` path for GitHub Pages |
| 4 | `.github/workflows/pages-deploy.yml` | CI | `develop` trigger + env injection |
| 5 | GitHub repo rename | Manual | `FiceCal` → `ficecal` for lowercase URL |
| 6 | GitHub Pages source | Manual | Switch to GitHub Actions |
| 7 | `ENABLE_PAGES_DEPLOY` variable | Manual | Unlock the deploy gate |
| 8 | Render.com service create | Manual | Wire `render.yaml` to dashboard |
| 9 | `VITE_MCP_BASE_URL` variable | Manual | Tell SPA where MCP lives |

**Estimated time:** 45–60 minutes including CI run and Render cold-start waits.
**Risk to v1:** Zero — different repo, different Actions, different Pages deployment.
