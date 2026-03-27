# envlock-core

Framework-agnostic 1Password + dotenvx secret injection logic.

> Most users should install [`envlock-next`](https://www.npmjs.com/package/envlock-next) instead. This package is for integrating envlock with frameworks other than Next.js.

## Install

```bash
pnpm add envlock-core
```

## Usage

### `envlock.config.js`

Create `envlock.config.js` in your project root:

```js
// envlock.config.js
export default {
  onePasswordEnvId: 'ca6uypwvab5mevel44gqdc2zae',
  envFiles: {
    development: '.env.development',
    staging: '.env.staging',
    production: '.env.production',
  },
  commands: {
    dev:   'node server.js --watch',
    start: 'node server.js --port 3000',
    build: 'node build.js',
  },
};
```

Then wire up your `package.json` scripts:

```json
{
  "scripts": {
    "dev":   "envlock dev",
    "build": "envlock build --production",
    "start": "envlock start --production"
  }
}
```

Pass `--staging` or `--production` to switch environments. For ad-hoc commands, pass the command directly without a config key:

```bash
envlock node server.js --production
```

Set `ENVLOCK_OP_ENV_ID` to provide the 1Password Environment ID via env var instead of the config file. In CI, set `DOTENV_PRIVATE_KEY_<ENV>` directly and `op run` is skipped automatically.

## API

### `runWithSecrets(options)`

Runs a command with secrets injected from 1Password via dotenvx. If `DOTENV_PRIVATE_KEY_<ENV>` is already set (e.g. in CI), it skips `op run` and calls `dotenvx run` directly.

**Options:**

| Option             | Type          | Description                                               |
| ------------------ | ------------- | --------------------------------------------------------- |
| `envFile`          | `string`      | Path to the encrypted dotenvx env file                    |
| `environment`      | `Environment` | Environment name (`development`, `staging`, `production`) |
| `onePasswordEnvId` | `string`      | Your 1Password Environment ID                             |
| `command`          | `string`      | The command to run                                        |
| `args`             | `string[]`    | Arguments to pass to the command                          |

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
const ENVIRONMENTS = {
  development: 'development',
  staging: 'staging',
  production: 'production',
} as const;

type Environment = keyof typeof ENVIRONMENTS;

interface EnvlockOptions {
  onePasswordEnvId: string;
  envFiles?: Partial<Record<Environment, string>>;
}

interface RunWithSecretsOptions {
  envFile: string;
  environment: Environment;
  onePasswordEnvId: string;
  command: string;
  args: string[];
}
```

## License

MIT — [Benjamin Davies](https://github.com/BenDavies1218)
