# envlock-core

Framework-agnostic 1Password + dotenvx secret injection logic.

> If you are using NextJs should install [`envlock-next`](https://www.npmjs.com/package/envlock-next) instead. This package is for integrating envlock with frameworks other than Next.js.

## Prerequisites

- [1Password CLI](https://developer.1password.com/docs/cli/get-started/) (`op`) installed and signed in
- [dotenvx](https://dotenvx.com/docs/install) installed (`npm install -g @dotenvx/dotenvx`)
- Encrypted `.env.*` files committed to your repo (see [dotenvx quickstart](https://dotenvx.com/docs/quickstart))

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
  onePasswordEnvId: '',
  envFiles?: { // Optional just incase you want to specify an overide usefull for monorepo's
    development: '.env.development',
    staging: '.env.staging',
    production: '.env.production',
  },
  commands: {
    start: 'npx envlock-core start',
    build: 'node '
  },
};
```

### Using Package.json

Then wire up your `package.json` scripts:

```json
{
  "scripts": {
    "start": "npx envlock-core start",
    "build": "npx envlock-core build"
  }
}
```

Then run:

```bash
npm run start                  # uses .env.development (default)
npm run start -- --staging     # uses .env.staging
npm run start -- --production  # uses .env.production
npm run build
```

### Not using package.json

This command below can be run using the following

```bash
npx envlock-core dev                # uses .env.development (default)
npx envlock-core dev --staging      # uses .env.staging
npx envlock-core dev --production   # uses .env.production
npx envlock-core start
npx envlock-core build
```

```js
// envlock.config.js
export default {
  onePasswordEnvId: "ca6uypwvab5mevel44gqdc2zae",
  commands: {
    dev: "node server.js --watch",
    start: "node server.js --port 3000",
    build: "node build.js",
  },
};
```

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

### `setVerbose(verbose)`

Enables or disables debug-level log output. When `true`, envlock logs the resolved config path, environment, env file, and spawned command to stderr. Called automatically when `--debug` / `-d` is passed on the CLI.

## Types

```ts
const ENVIRONMENTS = {
  development: "development",
  staging: "staging",
  production: "production",
} as const;

type Environment = keyof typeof ENVIRONMENTS;

interface EnvlockConfig {
  onePasswordEnvId?: string; // or set ENVLOCK_OP_ENV_ID env var
  envFiles?: Partial<Record<Environment, string>>;
  commands?: Record<string, string>;
}

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
