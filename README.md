# envlock

Inject secrets from 1Password into your Next.js app at dev/build/start time using [dotenvx](https://dotenvx.com) encrypted env files.

No secrets ever touch your shell history, CI environment variables, or unencrypted `.env` files.

## Packages

| Package | Description |
|---------|-------------|
| [`envlock-next`](./packages/next) | Next.js plugin, `createEnv` wrapper, and `envlock` CLI |
| [`envlock-core`](./packages/core) | Framework-agnostic 1Password + dotenvx invocation logic |

Most users only need `envlock-next`.

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
