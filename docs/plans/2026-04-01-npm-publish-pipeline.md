# NPM Publish Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two GitHub Actions workflows that publish `envlock-core` and `envlock-next` to npm when a version tag is pushed.

**Architecture:** Two isolated workflow files — `publish-core.yml` and `publish-next.yml` — each triggered by their own tag pattern (`envlock-core@*` / `envlock-next@*`). The version is extracted from the tag, written into `package.json`, then the package is built, type-checked, tested, and published.

**Tech Stack:** GitHub Actions, pnpm, Node 20, TypeScript (`tsc --noEmit`), npm registry

---

### Task 1: Create `publish-core.yml`

**Files:**
- Create: `.github/workflows/publish-core.yml`

**Step 1: Create the workflow file**

```yaml
name: Publish envlock-core

on:
  push:
    tags:
      - 'envlock-core@*'

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Extract version from tag
        id: version
        run: echo "VERSION=${GITHUB_REF_NAME#envlock-core@}" >> $GITHUB_OUTPUT

      - name: Set package version
        working-directory: packages/core
        run: pnpm version ${{ steps.version.outputs.VERSION }} --no-git-tag-version

      - name: Build
        working-directory: packages/core
        run: pnpm build

      - name: Type check
        working-directory: packages/core
        run: pnpm exec tsc --noEmit

      - name: Test
        working-directory: packages/core
        run: pnpm test

      - name: Publish
        working-directory: packages/core
        run: pnpm publish --no-git-checks --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.ENVLOCK_TOKEN }}
```

**Step 2: Verify the file exists**

```bash
cat .github/workflows/publish-core.yml
```

Expected: file contents printed.

**Step 3: Commit**

```bash
git add .github/workflows/publish-core.yml
git commit -m "ci: add publish-core workflow"
```

---

### Task 2: Create `publish-next.yml`

**Files:**
- Create: `.github/workflows/publish-next.yml`

**Step 1: Create the workflow file**

```yaml
name: Publish envlock-next

on:
  push:
    tags:
      - 'envlock-next@*'

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Extract version from tag
        id: version
        run: echo "VERSION=${GITHUB_REF_NAME#envlock-next@}" >> $GITHUB_OUTPUT

      - name: Set package version
        working-directory: packages/next
        run: pnpm version ${{ steps.version.outputs.VERSION }} --no-git-tag-version

      - name: Build
        working-directory: packages/next
        run: pnpm build

      - name: Type check
        working-directory: packages/next
        run: pnpm exec tsc --noEmit

      - name: Test
        working-directory: packages/next
        run: pnpm test

      - name: Publish
        working-directory: packages/next
        run: pnpm publish --no-git-checks --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.ENVLOCK_TOKEN }}
```

**Note:** pnpm automatically rewrites `workspace:^` to the real published version of `envlock-core` during `pnpm publish`, so no extra step is needed.

**Step 2: Verify the file exists**

```bash
cat .github/workflows/publish-next.yml
```

Expected: file contents printed.

**Step 3: Commit**

```bash
git add .github/workflows/publish-next.yml
git commit -m "ci: add publish-next workflow"
```

---

### Task 3: Verify and test locally

**Step 1: Lint both YAML files**

```bash
npx js-yaml .github/workflows/publish-core.yml && echo "core: valid"
npx js-yaml .github/workflows/publish-next.yml && echo "next: valid"
```

Expected: `core: valid` and `next: valid` — no YAML parse errors.

**Step 2: Confirm tag extraction logic**

```bash
GITHUB_REF_NAME="envlock-core@0.6.3"
echo "${GITHUB_REF_NAME#envlock-core@}"
# Expected: 0.6.3

GITHUB_REF_NAME="envlock-next@0.7.0"
echo "${GITHUB_REF_NAME#envlock-next@}"
# Expected: 0.7.0
```

**Step 3: Confirm pnpm version command works in each package**

```bash
# Dry run — check it doesn't error, then discard the change
cd packages/core && pnpm version 0.6.3 --no-git-tag-version && git checkout -- package.json && cd ../..
cd packages/next && pnpm version 0.6.3 --no-git-tag-version && git checkout -- package.json && cd ../..
```

Expected: no errors, `package.json` restored.

**Step 4: Push to GitHub and verify workflows appear**

```bash
git push
```

Then go to `https://github.com/BenDavies1218/envlock/actions` — both workflow files should appear in the list (even before a tag is pushed).

---

### Task 4: How to publish (runbook)

No code — this is the reference for how to trigger a publish once the workflows are live.

**To publish `envlock-core@0.6.3`:**

```bash
git tag envlock-core@0.6.3
git push origin envlock-core@0.6.3
```

**To publish `envlock-next@0.7.0`:**

```bash
git tag envlock-next@0.7.0
git push origin envlock-next@0.7.0
```

The workflow will extract the version, build, type-check, test, and publish. Monitor progress at `https://github.com/BenDavies1218/envlock/actions`.
