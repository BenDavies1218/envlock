# envlock-next

[![npm](https://img.shields.io/npm/v/envlock-next)](https://www.npmjs.com/package/envlock-next)
[![CI](https://github.com/BenDavies1218/envlock/actions/workflows/ci.yml/badge.svg)](https://github.com/BenDavies1218/envlock/actions/workflows/ci.yml)

Next.js plugin and CLI for injecting secrets from 1Password into your app at runtime using [dotenvx](https://dotenvx.com) encrypted env files.

No secrets ever touch your shell history, CI environment variables, or unencrypted `.env` files.

> For non-Next.js projects, use [`envlock-core`](https://www.npmjs.com/package/envlock-core) instead.

## Prerequisites

- [1Password CLI](https://developer.1password.com/docs/cli/get-started/) (`op`) installed and signed in
- Encrypted `.env.*` files committed to your repo (see [dotenvx quickstart](https://dotenvx.com/docs/quickstart))

## Installation

```bash
npm install envlock-next
```

## Setup

### 1. Update your scripts

```json
{
  "scripts": {
    "dev": "envlock dev",
    "build": "envlock build",
    "start": "envlock start"
  }
}
```

### 2. Add `withEnvlock` to your Next.js config

```ts
import { withEnvlock } from "envlock-next";

export default withEnvlock(
  {
    // your existing Next.js config
  },
  {
    onePasswordEnvId: "your-1password-env-id",
  },
);
```

Your 1Password Environment ID can be found in the 1Password dashboard under **Developer → Environments → Manage Environment**.

Alternatively, set `ENVLOCK_OP_ENV_ID` as an environment variable instead of passing it to `withEnvlock`.

### 3. Encrypt your env files

```bash
npx @dotenvx/dotenvx set API_SECRET "my-secret" -f .env.development
```

This writes encrypted values to `.env.development` and the private key to `.env.keys`. Commit `.env.development`, never commit `.env.keys`.

## CLI Usage

```bash
envlock dev          # next dev with .env.development secrets
envlock build        # next build with .env.production secrets
envlock start        # next start with .env.production secrets
envlock run <cmd>    # run any command with secrets injected
```

**Environment flags:**

```bash
envlock dev --staging      # use .env.staging
envlock build --staging    # use .env.staging
```

**Auto port switching:**

If the default port (3000) is in use, `envlock dev` automatically finds the next free port:

```text
[envlock] Warning: Port 3000 in use, switching to 3001
```

**Debug output:**

```bash
envlock dev --debug
```

## How it works

envlock injects secrets in two phases:

1. **`op run` phase** — envlock re-invokes itself inside `op run --environment <id>`. The 1Password CLI injects `DOTENV_PRIVATE_KEY_<ENV>` into the child process environment.
2. **`dotenvx` phase** — the re-invoked process detects the private key already set, calls the `dotenvx` JS API to decrypt the encrypted `.env.*` file, and starts Next.js with secrets in its environment.

In CI or on Vercel, set `DOTENV_PRIVATE_KEY_<ENV>` directly as a secret. envlock detects it and skips the `op run` phase entirely.

## Deploying to Vercel

Add the private key from `.env.keys` to your Vercel project under **Settings → Environment Variables**:

| Name                             | Environment |
| -------------------------------- | ----------- |
| `DOTENV_PRIVATE_KEY_PRODUCTION`  | Production  |
| `DOTENV_PRIVATE_KEY_STAGING`     | Preview     |
| `DOTENV_PRIVATE_KEY_DEVELOPMENT` | Development |

During the Vercel build, envlock detects the key is already set and decrypts your env file without calling 1Password.

## License

MIT — [Benjamin Davies](https://github.com/BenDavies1218)
