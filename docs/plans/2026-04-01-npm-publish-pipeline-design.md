# NPM Publish Pipeline Design

**Date:** 2026-04-01
**Scope:** `.github/workflows/`

## Summary

Two separate GitHub Actions workflows — one per package — that publish to npm when a version tag is pushed. Each workflow is fully isolated and independently triggered.

## Tag Convention

| Tag | Publishes |
|---|---|
| `envlock-core@0.6.3` | `envlock-core` package |
| `envlock-next@0.6.3` | `envlock-next` package |

The version is extracted from the tag and written into `package.json` before publishing, so the tag is the single source of truth for the version.

## Workflow Files

- `.github/workflows/publish-core.yml` — triggered by `envlock-core@*` tags
- `.github/workflows/publish-next.yml` — triggered by `envlock-next@*` tags

## Step Order (both workflows)

1. Checkout repo
2. Setup pnpm + Node 20
3. `pnpm install --frozen-lockfile`
4. Extract version from tag (strip package-name prefix)
5. `pnpm version <x.y.z> --no-git-tag-version` in the package directory
6. `pnpm build`
7. `tsc --noEmit` (type check)
8. `pnpm test`
9. `pnpm publish --no-git-checks --access public`

## Secrets & Environment

- npm token secret: `ENVLOCK_TOKEN`
- GitHub environment: `production`
- Workflow permission: default (no write-back to repo)

## publish-next extras

pnpm rewrites `workspace:^` dependencies to real versions automatically during publish via `pnpm publish`. No extra step needed.

## README Updates

Manual — update version references in `README.md` before pushing the tag.
