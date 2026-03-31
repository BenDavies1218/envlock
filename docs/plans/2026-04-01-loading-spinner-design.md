# Loading Spinner Design

**Date:** 2026-04-01
**Scope:** `packages/core`

## Summary

Add a zero-dependency terminal spinner to `envlock-core` that displays progress during the two slow operations in `runWithSecrets`: fetching secrets via 1Password CLI (`op run`) and decrypting the env file via dotenvx.

## New File: `packages/core/src/spinner.ts`

A private module (not exported from `index.ts`) with a single spinner instance and three methods:

- `spinner.start(msg: string)` — starts a `setInterval` at 80ms, writing a braille frame + message to stderr using `\r` to overwrite the current line
- `spinner.stop()` — clears the current line with `\r\x1b[K` and clears the interval
- `spinner.fail(msg: string)` — calls `stop()` then writes an error line (for future use; normal error paths use `log.error`)

Frame set: `['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']`

If `process.stderr.isTTY` is falsy, all methods are no-ops (silent in CI/piped output).

## Changes to `packages/core/src/invoke.ts`

Two spinner wraps inside `runWithSecrets`:

**Phase 1 — 1Password re-invocation:**
```
spinner.start("Fetching secrets from 1Password…")
// ... validation ...
spinner.stop()   // must clear before spawnSync with stdio: "inherit"
spawnSync("op", [...])
```

**Phase 2 — dotenvx decryption:**
```
spinner.start("Decrypting .env file…")
const { config } = await import("@dotenvx/dotenvx")
config({ path: envFile })
spinner.stop()
```

Both phases call `spinner.stop()` in a `finally` block to guarantee line cleanup on error.

## Constraints

- Zero new dependencies
- Spinner writes to `stderr` only (matches existing logger)
- No-op when `process.stderr.isTTY` is falsy
- Spinner must be stopped before any `spawnSync` with `stdio: "inherit"` to avoid interleaved output
- Not exported from public API — internal to `core`
