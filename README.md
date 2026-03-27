# envlock

[![CI](https://github.com/BenDavies1218/envlock/actions/workflows/ci.yml/badge.svg)](https://github.com/BenDavies1218/envlock/actions/workflows/ci.yml)
[![Typecheck](https://github.com/BenDavies1218/envlock/actions/workflows/typecheck.yml/badge.svg)](https://github.com/BenDavies1218/envlock/actions/workflows/typecheck.yml)

Inject secrets from 1Password into your app at run time using [dotenvx](https://dotenvx.com) encrypted env files.

No secrets ever touch your shell history, CI environment variables, or unencrypted `.env` files.

## Packages

| Package                           | Description                                                               |
| --------------------------------- | ------------------------------------------------------------------------- |
| [`envlock-next`](./packages/next) | Next.js plugin and `envlock` CLI                                          |
| [`envlock-core`](./packages/core) | Framework-agnostic `envlock` CLI and 1Password + dotenvx invocation logic |

Use `envlock-next` for Next.js projects. Use `envlock-core` directly for any other Node.js project.

## How it works

```
1Password (secrets store)
        ↓  op run
dotenvx (decrypts .env.* files)
        ↓  dotenvx run
your command (next dev, node server.js, …)
```

`envlock` wraps your commands. It pulls the dotenvx private key from 1Password at runtime, decrypts your encrypted `.env` file, and injects the env vars into the process. In CI, you supply the private key directly via `DOTENV_PRIVATE_KEY_<ENV>` and `op run` is skipped.

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
