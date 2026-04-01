# envlock-core

[![npm](https://img.shields.io/npm/v/envlock-core)](https://www.npmjs.com/package/envlock-core)
[![CI](https://github.com/BenDavies1218/envlock/actions/workflows/ci.yml/badge.svg)](https://github.com/BenDavies1218/envlock/actions/workflows/ci.yml)

Framework-agnostic CLI for injecting secrets from 1Password into your app at runtime using [dotenvx](https://dotenvx.com) encrypted env files.

No secrets ever touch your shell history, CI environment variables, or unencrypted `.env` files.

> For Next.js projects, use [`envlock-next`](https://www.npmjs.com/package/envlock-next) instead.

## Prerequisites

- [1Password CLI](https://developer.1password.com/docs/cli/get-started/) (`op`) installed and signed in
- Encrypted `.env.*` files committed to your repo (see [dotenvx quickstart](https://dotenvx.com/docs/quickstart))

## Installation

```bash
npm install envlock-core
```

## Setup

Create `envlock.config.ts` in your project root:

```ts
export default {
  onePasswordEnvId: "your-1password-env-id",
  commands: {
    dev: "node server.js --watch",
    start: "node server.js",
    build: "node build.js",
  },
};
```

Update your `package.json` scripts:

```json
{
  "scripts": {
    "dev": "envlock dev",
    "start": "envlock start",
    "build": "envlock build"
  }
}
```

## CLI Usage

```bash
# Run a named command from envlock.config.ts
envlock dev
envlock start --production

# Run any command directly
envlock run node server.js
envlock run python app.py --port 4000
```

**Environment flags:**

```bash
envlock dev                 # uses .env.development (default)
envlock start --staging     # uses .env.staging
envlock start --production  # uses .env.production
```

**Debug output:**

```bash
envlock dev --debug
```

## How it works

envlock injects secrets in two phases:

1. **`op run` phase** — envlock re-invokes itself inside `op run --environment <id>`. The 1Password CLI injects `DOTENV_PRIVATE_KEY_<ENV>` into the child process environment.
2. **`dotenvx` phase** — the re-invoked process detects the private key already set, calls the `dotenvx` JS API to decrypt the encrypted `.env.*` file, and spawns your command with secrets in its environment.

In CI, set `DOTENV_PRIVATE_KEY_<ENV>` directly as a secret. envlock detects it and skips the `op run` phase entirely.

## Programmatic API

```ts
import { runWithSecrets, findFreePort, log, setVerbose } from "envlock-core";

// Run a command with secrets injected
await runWithSecrets({
  envFile: ".env.development",
  environment: "development",
  onePasswordEnvId: "your-env-id",
  command: "node",
  args: ["server.js"],
});

// Find a free port starting from preferred
const port = await findFreePort(3000); // 3000, or 3001 if taken, etc.
```

### `runWithSecrets(options)`

| Option             | Type          | Description                                               |
| ------------------ | ------------- | --------------------------------------------------------- |
| `envFile`          | `string`      | Path to the encrypted dotenvx env file                    |
| `environment`      | `Environment` | `"development"`, `"staging"`, or `"production"`           |
| `onePasswordEnvId` | `string`      | Your 1Password Environment ID                             |
| `command`          | `string`      | The command to run                                        |
| `args`             | `string[]`    | Arguments to pass to the command                          |

### `validateOnePasswordEnvId(id)`

Throws if `id` is not a valid 1Password Environment ID. Guards against CLI injection and shell metacharacters.

### `validateEnvFilePath(envFile, cwd)`

Throws if `envFile` resolves outside `cwd`. Guards against path traversal.

### `findFreePort(preferred)`

Returns `preferred` if available, otherwise the next free port above it.

### `setVerbose(enabled)`

Enables debug-level log output. Called automatically when `--debug` / `-d` is passed on the CLI.

## License

MIT — [Benjamin Davies](https://github.com/BenDavies1218)
