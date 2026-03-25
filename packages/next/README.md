# envlock-next

Inject secrets from 1Password into your Next.js app at dev/build/start time using [dotenvx](https://dotenvx.com) encrypted env files.

## Prerequisites

- [1Password CLI](https://developer.1password.com/docs/cli/get-started/) (`op`) installed and signed in
- [dotenvx](https://dotenvx.com/docs/install) installed (`npm install -g @dotenvx/dotenvx`)
- Encrypted `.env.*` files committed to your repo (see [dotenvx quickstart](https://dotenvx.com/docs/quickstart))

## Install

```bash
pnpm add envlock-next
```

## Setup

### 1. Configure `next.config.js`

```js
import { withEnvlock } from 'envlock-next';

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
import { createEnv } from 'envlock-next';
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
