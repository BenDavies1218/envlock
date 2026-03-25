# CI, Documentation, and npm Publishing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the envlock monorepo production-ready with CI, typecheck, npm publish workflows, npm package metadata on both packages, and three READMEs.

**Architecture:** Three GitHub Actions workflows (ci, typecheck, publish), npm metadata added to both package.json files, and three READMEs (root overview + per-package npm docs). No new source code — configuration and documentation only.

**Tech Stack:** GitHub Actions, pnpm, Node 22, npm

---

### Task 1: Add CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    name: Build & Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build @envlock/core
        run: pnpm --filter @envlock/core build

      - name: Build @envlock/next
        run: pnpm --filter @envlock/next build

      - name: Run tests
        run: pnpm test
```

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add CI workflow"
```

Expected: commit with 1 file.

---

### Task 2: Add typecheck workflow

**Files:**
- Create: `.github/workflows/typecheck.yml`

**Step 1: Create `.github/workflows/typecheck.yml`**

```yaml
name: Typecheck

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck:
    name: TypeScript
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build @envlock/core (required for @envlock/next types)
        run: pnpm --filter @envlock/core build

      - name: Typecheck @envlock/core
        run: pnpm --filter @envlock/core exec tsc --noEmit

      - name: Typecheck @envlock/next
        run: pnpm --filter @envlock/next exec tsc --noEmit
```

**Step 2: Commit**

```bash
git add .github/workflows/typecheck.yml
git commit -m "ci: add typecheck workflow"
```

---

### Task 3: Add publish workflow

**Files:**
- Create: `.github/workflows/publish.yml`

**Step 1: Create `.github/workflows/publish.yml`**

```yaml
name: Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    name: Publish to npm
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build @envlock/core
        run: pnpm --filter @envlock/core build

      - name: Build @envlock/next
        run: pnpm --filter @envlock/next build

      - name: Publish @envlock/core
        run: pnpm --filter @envlock/core publish --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Publish @envlock/next
        run: pnpm --filter @envlock/next publish --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Step 2: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: add npm publish workflow"
```

---

### Task 4: Add npm metadata to both package.json files

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/next/package.json`

**Step 1: Update `packages/core/package.json`**

Replace the entire file with:

```json
{
  "name": "@envlock/core",
  "version": "0.1.0",
  "type": "module",
  "description": "Core 1Password + dotenvx secret injection logic for envlock",
  "license": "MIT",
  "author": "Benjamin Davies",
  "homepage": "https://github.com/BenDavies1218/envlock#readme",
  "repository": {
    "type": "git",
    "url": "https://github.com/BenDavies1218/envlock.git",
    "directory": "packages/core"
  },
  "bugs": {
    "url": "https://github.com/BenDavies1218/envlock/issues"
  },
  "engines": {
    "node": ">=18"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/node": "^20.14.10",
    "tsup": "^8.0.0",
    "typescript": "^5.8.2",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Update `packages/next/package.json`**

Replace the entire file with:

```json
{
  "name": "@envlock/next",
  "version": "0.1.0",
  "type": "module",
  "description": "Next.js plugin, createEnv wrapper, and CLI for envlock",
  "license": "MIT",
  "author": "Benjamin Davies",
  "homepage": "https://github.com/BenDavies1218/envlock#readme",
  "repository": {
    "type": "git",
    "url": "https://github.com/BenDavies1218/envlock.git",
    "directory": "packages/next"
  },
  "bugs": {
    "url": "https://github.com/BenDavies1218/envlock/issues"
  },
  "engines": {
    "node": ">=18"
  },
  "bin": {
    "envlock": "./dist/cli/index.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@envlock/core": "workspace:*",
    "commander": "^12.0.0"
  },
  "peerDependencies": {
    "@t3-oss/env-nextjs": ">=0.12.0",
    "next": ">=14.0.0",
    "zod": ">=3.0.0"
  },
  "peerDependenciesMeta": {
    "@t3-oss/env-nextjs": {
      "optional": true
    },
    "zod": {
      "optional": true
    }
  },
  "devDependencies": {
    "@envlock/core": "workspace:*",
    "@t3-oss/env-nextjs": "^0.12.0",
    "@types/node": "^20.14.10",
    "next": "^15.2.3",
    "tsup": "^8.0.0",
    "typescript": "^5.8.2",
    "vitest": "^3.0.0",
    "zod": "^3.24.2"
  }
}
```

**Step 3: Commit**

```bash
git add packages/core/package.json packages/next/package.json
git commit -m "chore: add npm metadata to package.json files"
```

---

### Task 5: Write root `README.md`

**Files:**
- Create: `README.md`

**Step 1: Create `README.md`**

```markdown
# envlock

Inject secrets from 1Password into your Next.js app at dev/build/start time using [dotenvx](https://dotenvx.com) encrypted env files.

No secrets ever touch your shell history, CI environment variables, or unencrypted `.env` files.

## Packages

| Package | Description |
|---------|-------------|
| [`@envlock/next`](./packages/next) | Next.js plugin, `createEnv` wrapper, and `envlock` CLI |
| [`@envlock/core`](./packages/core) | Framework-agnostic 1Password + dotenvx invocation logic |

Most users only need `@envlock/next`.

## How it works

```
1Password (secrets store)
        ↓  op run
dotenvx (decrypts .env.* files)
        ↓  dotenvx run
next dev / next build / next start
```

`envlock` wraps your `next` commands. It pulls the dotenvx private key from 1Password at runtime, decrypts your encrypted `.env` file, and injects the env vars into the Next.js process. In CI, you supply the private key directly via `DOTENV_PRIVATE_KEY_<ENV>` and `op run` is skipped.

## Contributing

**Prerequisites:** Node 18+, pnpm 9+

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test
```

Packages are in `packages/`. Each has its own `tsup` build and `vitest` test suite.

## License

MIT — [Benjamin Davies](https://github.com/BenDavies1218)
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add root README"
```

---

### Task 6: Write `packages/core/README.md`

**Files:**
- Create: `packages/core/README.md`

**Step 1: Create `packages/core/README.md`**

```markdown
# @envlock/core

Framework-agnostic 1Password + dotenvx secret injection logic.

> Most users should install [`@envlock/next`](https://www.npmjs.com/package/@envlock/next) instead. This package is for integrating envlock with frameworks other than Next.js.

## Install

```bash
pnpm add @envlock/core
```

## API

### `runWithSecrets(options)`

Runs a command with secrets injected from 1Password via dotenvx. If `DOTENV_PRIVATE_KEY_<ENV>` is already set (e.g. in CI), it skips `op run` and calls `dotenvx run` directly.

```ts
import { runWithSecrets } from '@envlock/core';

runWithSecrets({
  envFile: '.env.production',
  environment: 'production',
  onePasswordEnvId: 'ca6uypwvab5mevel44gqdc2zae',
  command: 'node',
  args: ['server.js'],
});
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `envFile` | `string` | Path to the encrypted dotenvx env file |
| `environment` | `string` | Environment name (`development`, `staging`, `production`) |
| `onePasswordEnvId` | `string` | Your 1Password Environment ID |
| `command` | `string` | The command to run |
| `args` | `string[]` | Arguments to pass to the command |

### `validateOnePasswordEnvId(id)`

Throws if `id` is not a valid 1Password Environment ID (lowercase alphanumeric + hyphens). Protects against CLI flag injection and shell metacharacters.

### `validateEnvFilePath(envFile, cwd)`

Throws if `envFile` resolves outside `cwd`. Protects against path traversal.

### `hasBinary(name)`

Returns `true` if `name` is found in `PATH`.

### `checkBinary(name, installHint)`

Calls `process.exit(1)` with a helpful message if `name` is not in `PATH`.

## Types

```ts
type Environment = 'development' | 'staging' | 'production';

interface EnvlockOptions {
  onePasswordEnvId: string;
  envFiles?: {
    development?: string;
    staging?: string;
    production?: string;
  };
}

interface RunWithSecretsOptions {
  envFile: string;
  environment: string;
  onePasswordEnvId: string;
  command: string;
  args: string[];
}
```

## License

MIT — [Benjamin Davies](https://github.com/BenDavies1218)
```

**Step 2: Commit**

```bash
git add packages/core/README.md
git commit -m "docs: add @envlock/core README"
```

---

### Task 7: Write `packages/next/README.md`

**Files:**
- Create: `packages/next/README.md`

**Step 1: Create `packages/next/README.md`**

```markdown
# @envlock/next

Inject secrets from 1Password into your Next.js app at dev/build/start time using [dotenvx](https://dotenvx.com) encrypted env files.

## Prerequisites

- [1Password CLI](https://developer.1password.com/docs/cli/get-started/) (`op`) installed and signed in
- [dotenvx](https://dotenvx.com/docs/install) installed (`npm install -g @dotenvx/dotenvx`)
- Encrypted `.env.*` files committed to your repo (see [dotenvx quickstart](https://dotenvx.com/docs/quickstart))

## Install

```bash
pnpm add @envlock/next
```

## Setup

### 1. Configure `next.config.js`

```js
import { withEnvlock } from '@envlock/next';

export default withEnvlock(
  {
    // your existing Next.js config
  },
  {
    onePasswordEnvId: 'ca6uypwvab5mevel44gqdc2zae', // your 1Password Environment ID
  },
);
```

Find your **Environment ID** in 1Password → Settings → Developer → Environments.

### 2. Update `package.json` scripts

```json
{
  "scripts": {
    "dev": "envlock dev",
    "build": "envlock build",
    "start": "envlock start"
  }
}
```

That's it. `envlock dev` will pull your dotenvx private key from 1Password, decrypt `.env.development`, and start Next.js with your secrets injected.

## Environment flags

By default, `envlock dev` uses `.env.development`. Use flags to target other environments:

```bash
envlock dev --staging       # uses .env.staging
envlock dev --production    # uses .env.production
envlock build --staging
envlock build --production
envlock start --production
```

## Custom env file paths

Override the default file paths in `next.config.js`:

```js
export default withEnvlock(
  {},
  {
    onePasswordEnvId: 'ca6uypwvab5mevel44gqdc2zae',
    envFiles: {
      development: '.env.local',
      staging: '.env.staging.local',
      production: '.env.production',
    },
  },
);
```

## Environment variable fallback

If `ENVLOCK_OP_ENV_ID` is set, envlock uses it instead of reading `next.config.js`. Useful for CI environments where you don't want to load the config file.

```bash
ENVLOCK_OP_ENV_ID=ca6uypwvab5mevel44gqdc2zae envlock build --production
```

## CI usage

In CI, set `DOTENV_PRIVATE_KEY_<ENV>` directly. envlock detects this and skips `op run`, calling `dotenvx run` only:

```yaml
- name: Build
  run: pnpm build
  env:
    DOTENV_PRIVATE_KEY_PRODUCTION: ${{ secrets.DOTENV_PRIVATE_KEY_PRODUCTION }}
```

## `createEnv` wrapper

envlock re-exports a `createEnv` wrapper around [`@t3-oss/env-nextjs`](https://env.t3.gg) with sensible defaults:

```js
// src/env.js
import { createEnv } from '@envlock/next';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    API_SECRET: process.env.API_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});
```

Defaults applied: `emptyStringAsUndefined: true`, `skipValidation` reads from `SKIP_ENV_VALIDATION` env var.

Requires `@t3-oss/env-nextjs` and `zod` as peer dependencies:

```bash
pnpm add @t3-oss/env-nextjs zod
```

## License

MIT — [Benjamin Davies](https://github.com/BenDavies1218)
```

**Step 2: Verify all tests still pass**

```bash
pnpm test
```

Expected: 32 tests passing.

**Step 3: Commit**

```bash
git add packages/next/README.md
git commit -m "docs: add @envlock/next README"
```
