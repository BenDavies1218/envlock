# envlock-core CLI Design

**Date:** 2026-03-27
**Status:** Approved

## Summary

Add an `envlock` binary to `envlock-core` that reads an `envlock.config.ts` file, resolves the environment from `--staging` / `--production` flags, and runs the user's command with secrets injected via 1Password + dotenvx. Named commands (with their own args) are defined in config. Ad-hoc commands still work inline.

## CLI Usage

```bash
# Named commands from envlock.config.ts
envlock dev                  # node server.js --watch + .env.development
envlock dev --staging        # node server.js --watch + .env.staging
envlock start --production   # node server.js --port 3000 + .env.production

# Ad-hoc (no config key match)
envlock node server.js --production
```

## Config File

**`envlock.config.ts`** (also supports `.js`, `.mjs`):

```ts
export default {
  onePasswordEnvId: 'ca6uypwvab5mevel44gqdc2zae',
  envFiles: {
    development: '.env.development',
    staging: '.env.staging',
    production: '.env.production',
  },
  commands: {
    dev: 'node server.js --watch',
    start: 'node server.js --port 3000',
    build: 'node build.js',
  },
};
```

- `onePasswordEnvId` — can also be set via `ENVLOCK_OP_ENV_ID` env var (env var takes precedence)
- `envFiles` — optional, defaults to `.env.development` / `.env.staging` / `.env.production`
- `commands` — named commands with their full arg strings

## package.json Integration

```json
{
  "scripts": {
    "dev":   "envlock dev",
    "build": "envlock build --production",
    "start": "envlock start --production"
  }
}
```

## Architecture

### New files in `packages/core/src/`

- `cli/index.ts` — binary entry point, parses flags, resolves config, dispatches to `runWithSecrets`
- `cli/resolve-config.ts` — loads `envlock.config.ts` / `.js` / `.mjs` from `cwd` using dynamic import

### Config type (added to `types.ts`)

```ts
interface EnvlockConfig {
  onePasswordEnvId?: string;
  envFiles?: Partial<Record<Environment, string>>;
  commands?: Record<string, string>;
}
```

### Resolution logic

1. Parse `--staging` / `--production` from `process.argv` → resolve `environment`
2. Strip env flags from remaining args
3. Load `envlock.config.ts` from `cwd` (if present)
4. First remaining arg checked against `config.commands`:
   - **Match** → split command string into binary + args
   - **No match** → treat all remaining args as ad-hoc command
5. Resolve `onePasswordEnvId` from `ENVLOCK_OP_ENV_ID` env var or config
6. Resolve `envFile` from config or default
7. Call `runWithSecrets`

## Error Handling

| Scenario | Behaviour |
|---|---|
| Config file missing | Falls back to ad-hoc mode |
| Named command not in config | Throws listing available commands |
| `onePasswordEnvId` not set anywhere | Throws with clear message |
| Invalid `onePasswordEnvId` | `validateOnePasswordEnvId` throws |
| Env file outside cwd | `validateEnvFilePath` throws |

## Testing

Tests in `packages/core/src/cli/index.test.ts` and `packages/core/src/cli/resolve-config.test.ts`:

| Scenario | Expected |
|---|---|
| No config file, ad-hoc command | Correct command + env resolved |
| Named command found in config | Command string split, correct env file |
| Named command not found | Throws listing available commands |
| `--staging` flag | `.env.staging` selected |
| `--production` flag | `.env.production` selected |
| No flag | Defaults to `development` |
| `ENVLOCK_OP_ENV_ID` env var | Takes precedence over config value |
| Config `onePasswordEnvId` only | Used when env var absent |

## package.json Changes

```json
{
  "bin": {
    "envlock": "./dist/cli/index.js"
  }
}
```
