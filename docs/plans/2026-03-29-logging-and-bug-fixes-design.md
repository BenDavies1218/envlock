# Design: Logging, Debug Flag, and Bug Fixes

**Date:** 2026-03-29
**Status:** Approved

## Overview

Two goals:

1. **Bug fixes** — three silent-failure bugs where envlock exits with code 0 or 1 and produces no output.
2. **Logging** — a `--debug`/`-d` flag that enables verbose diagnostic output, plus consistent always-on friendly error messages.

## Bug Fixes

### Fix 1: Symlink bug in `packages/next/src/cli/index.ts`

The same bug already fixed in `packages/core/src/cli/index.ts` exists in the Next.js CLI. The `import.meta.url === pathToFileURL(process.argv[1]).href` guard never matches when the CLI is invoked via an npm bin symlink, so `program.parse()` is never called and the process exits silently.

**Fix:** wrap `process.argv[1]` in `realpathSync` (with try/catch fallback) before passing to `pathToFileURL`, identical to the core fix.

### Fix 2: `checkBinary` throws instead of `process.exit()`

`packages/core/src/detect.ts` calls `process.exit(1)` inside a library function. This bypasses any outer error handler, is untestable, and gives no structured error to surface.

**Fix:** replace `process.exit(1)` with `throw new Error(...)`. Both call sites are in `invoke.ts`, which is called from CLI code that already has a catch handler.

### Fix 3: `spawnSync` error surfacing in `invoke.ts`

If `spawnSync` fails at the OS level (e.g. ENOENT after a binary-check race, permission error), `result.error` is set and `result.status` is `null`. Currently the process silently exits with code 1.

**Fix:** after `spawnSync` returns, check `result.error` first and throw with a clear message before falling through to `process.exit(result.status ?? 1)`.

## Logger Module

**File:** `packages/core/src/logger.ts`

A minimal singleton (≈25 lines, zero new dependencies):

```ts
let verbose = false;
export function setVerbose(flag: boolean): void { verbose = flag; }

export const log = {
  debug: (msg: string) => { if (verbose) process.stderr.write(`[envlock:debug] ${msg}\n`); },
  info:  (msg: string) => { process.stderr.write(`[envlock] ${msg}\n`); },
  warn:  (msg: string) => { process.stderr.write(`[envlock] Warning: ${msg}\n`); },
  error: (msg: string) => { process.stderr.write(`[envlock] Error: ${msg}\n`); },
};
```

All output goes to `stderr` — keeps `stdout` clean for piping.

## `--debug` / `-d` Flag

### `packages/core/src/cli/index.ts`

Hand-rolled arg parser — strip `--debug`/`-d` from `argv` at the top of the entry point guard, call `setVerbose(true)`, then pass the remaining args to `run()`.

### `packages/next/src/cli/index.ts`

Commander-based — add `.option('-d, --debug', 'enable debug output')` to the root `program`. Read the flag from `program.opts()` after `program.parseOptions(process.argv)` and call `setVerbose(true)` before subcommand dispatch.

## Logging Placement

| File | What is logged |
|---|---|
| `core/cli/index.ts` | `debug`: resolved argv[1] path, detected environment, final command + args |
| `next/cli/index.ts` | `debug`: resolved argv[1] path, detected environment, final command + args |
| `core/cli/resolve-config.ts` | `debug`: which config file was found (or none); existing `console.warn` → `log.warn` |
| `next/cli/resolve-config.ts` | `debug`: which config file was found (or none); existing `console.warn` → `log.warn` |
| `core/src/detect.ts` | `debug`: result of each binary check |
| `core/src/invoke.ts` | `debug`: full spawned command line; `error` on spawn failure |

`validate.ts` is unchanged — it already throws with clear messages.

## Example Output

**Normal run (no flag):**
```
(no envlock output — only the subprocess output)
```

**With `--debug`:**
```
[envlock:debug] Resolved argv[1]: /path/to/node_modules/envlock-core/dist/cli/index.js
[envlock:debug] Config loaded from envlock.config.js
[envlock:debug] Environment: development
[envlock:debug] Env file: .env.development
[envlock:debug] Binary check: dotenvx found
[envlock:debug] Binary check: op found
[envlock:debug] Spawning: op run --environment my-env-id -- dotenvx run -f .env.development -- node server.js
```

**On error (always shown):**
```
[envlock] Error: 'dotenvx' not found in PATH.
Install dotenvx: npm install -g @dotenvx/dotenvx
Or add it as a dev dependency.
```

## Files Changed

- `packages/core/src/logger.ts` — new file
- `packages/core/src/detect.ts` — throw instead of process.exit; add log.debug
- `packages/core/src/invoke.ts` — surface spawnSync errors; add log.debug
- `packages/core/src/cli/index.ts` — strip --debug flag; call setVerbose; add log.debug calls
- `packages/core/src/cli/resolve-config.ts` — console.warn → log.warn; add log.debug
- `packages/next/src/cli/index.ts` — symlink fix; --debug flag; setVerbose; add log.debug calls
- `packages/next/src/cli/resolve-config.ts` — console.warn → log.warn; add log.debug
