# CI, Documentation, and npm Publishing Design

**Date:** 2026-03-25
**Repo:** github.com/benjamindavies/envlock

---

## Goal

Make the envlock monorepo look and behave like a professional open-source dev tool: CI that validates every push, three READMEs (root + per package), and a tag-triggered npm publish workflow.

---

## GitHub Actions

Three workflows under `.github/workflows/`:

### `ci.yml`
- Triggers: push to `main`, all pull requests
- Steps: checkout, setup pnpm + Node 22, `pnpm install`, build core then next, `pnpm test`
- Purpose: fast feedback on every change

### `typecheck.yml`
- Triggers: same as CI
- Steps: checkout, setup pnpm + Node 22, `pnpm install`, `tsc --noEmit` in each package
- Purpose: catch type errors that tests may not cover

### `publish.yml`
- Triggers: `v*` tags (e.g. `v0.1.0`)
- Steps: checkout, setup pnpm + Node 22 with npm registry config, `pnpm install`, build core then next, publish core then next with `pnpm publish --access public --no-git-checks`
- Auth: `NODE_AUTH_TOKEN` from `NPM_TOKEN` repo secret
- Purpose: automated npm publish on manual tag push

---

## npm Package Metadata

Both `packages/core/package.json` and `packages/next/package.json` need:
- `"license": "MIT"`
- `"author": "Benjamin Davies"`
- `"homepage"`: GitHub repo URL
- `"repository"`: `{ "type": "git", "url": "..." }`
- `"bugs"`: GitHub issues URL
- `"engines": { "node": ">=18" }`

`@envlock/next` dependency on `@envlock/core`: pnpm replaces `workspace:*` with the resolved version on publish automatically — no manual change needed.

### Prerequisites for first publish
1. Create npm account
2. Create `@envlock` org on npm (free for public packages)
3. Generate npm automation token → add as `NPM_TOKEN` in GitHub repo secrets

---

## Documentation

### Root `README.md`
- What envlock does and why (1Password + dotenvx secret injection for Next.js)
- Architecture: `@envlock/core` (framework-agnostic) ← `@envlock/next` (Next.js plugin + CLI)
- Quick links to each package
- Contributor section: prerequisites, `pnpm install`, `pnpm build`, `pnpm test`

### `packages/core/README.md`
- What `@envlock/core` does
- Install: `pnpm add @envlock/core`
- API reference: `runWithSecrets`, `validateOnePasswordEnvId`, `validateEnvFilePath`, `hasBinary`, `checkBinary`
- TypeScript type exports: `RunWithSecretsOptions`, `EnvlockOptions`, `Environment`
- Note: most users should use `@envlock/next` instead

### `packages/next/README.md`
- What `@envlock/next` does (main user-facing doc)
- Prerequisites: 1Password CLI, dotenvx
- Install: `pnpm add @envlock/next`
- `withEnvlock()` setup in `next.config.js`
- `createEnv()` usage with `@t3-oss/env-nextjs` and zod
- CLI: `envlock dev`, `envlock build`, `envlock start`
- Environment flags: `--staging`, `--production`
- Custom env file paths via `envFiles` option
- `ENVLOCK_OP_ENV_ID` env var fallback
