# envlock core + next refactor design

**Date:** 2026-03-31
**Scope:** packages/core, packages/next
**Approach:** Option B — full refactor (code quality + security, no logger redesign)

---

## Goals

- Improve testability by extracting pure functions from large orchestrators
- Eliminate duplicated constants and validation logic between packages
- Add runtime type guards to dynamic config imports
- Defensive hardening of `isPortFree` timeout
- Consistency fixes (logging, magic numbers)

---

## packages/core

### 1. Export shared constants from core

Move `DEFAULT_ENV_FILES` and `ARGUMENT_FLAGS` from `core/cli/index.ts` into `core/src/types.ts` and export them from `core/src/index.ts`. The `next` package imports them from `envlock-core` instead of re-defining.

### 2. `find-port.ts` — timeout + named constant

- Extract `const PORT_SEARCH_RANGE = 10`
- Wrap `server.listen()` with `Promise.race` against a 2-second timeout that resolves `false`
- Use `PORT_SEARCH_RANGE` in the loop bound and the error message

### 3. `core/cli/resolve-config.ts` — runtime type guards

After dynamic import, validate shape before casting to `EnvlockConfig`:
- `onePasswordEnvId`: must be `string` if present
- `envFiles`: must be `object` if present
- On invalid shape: log warning, return `null`

### 4. `core/cli/index.ts` — split `run()`

Extract two pure functions, leaving `run()` as a thin orchestrator:

**`parseArgs(argv: string[])`** → `{ environment: Environment, passthrough: string[], debug: boolean }`
Handles: debug flag stripping, environment flag detection, passthrough filtering. No I/O.

**`resolveCommand(passthrough: string[], config: EnvlockConfig | null)`** → `{ command: string, args: string[] }`
Contains all `run`/named/ad-hoc branching logic. No I/O. Throws on invalid input.

**`run()`** becomes: `parseArgs` → load config → `resolveCommand` → validate id + env file → `runWithSecrets`.

Add JSDoc to `splitCommand` documenting the regex and its known limitation (no escaped-quote support).

---

## packages/next

### 5. `next/cli/resolve-config.ts` — runtime type guards + cjs candidate

- Add `typeof` checks: `__envlock.onePasswordEnvId` must be a non-empty string; `__envlock.envFiles` must be object if present
- Validate env var path (line 38) rather than casting directly
- Add `"next.config.cjs"` to `CONFIG_CANDIDATES`

### 6. `next/cli/index.ts` — extract helpers

**`resolveAndValidateConfig(environment: Environment, cwd: string)`** → `{ onePasswordEnvId: string, envFile: string }`
Consolidates the repeated block in `runNextCommand` and `handleRunCommand`: resolve config → pick id (env var wins) → validate id → pick env file → validate path → return.

**`updatePortArg(args: string[], newPort: number)`** → `string[]`
Pure function. Extracts the 21-line port-switching block from `runNextCommand`. Takes current args array and resolved free port, returns updated args array with port flag normalised to `["-p", newPort, ...rest]`.

Import `DEFAULT_ENV_FILES` and `ARGUMENT_FLAGS` from `envlock-core` instead of re-defining.

### 7. `plugin.ts` — use `log.warn`

Replace `console.warn(...)` with `log.warn(...)` (already imported from `envlock-core`).

---

## What is NOT changing

- Logger global state (`verbose` flag) — tests mock it fine today, redesign not justified
- `invoke.ts` — no changes needed
- `validate.ts` — security posture already solid
- Test files — existing tests should pass unchanged; new unit tests for `parseArgs`, `resolveCommand`, `updatePortArg` can be added separately

---

## File change summary

| File | Change |
|------|--------|
| `core/src/types.ts` | Add `DEFAULT_ENV_FILES`, `ARGUMENT_FLAGS` |
| `core/src/index.ts` | Export new constants |
| `core/src/find-port.ts` | `PORT_SEARCH_RANGE` const, timeout on `isPortFree` |
| `core/src/cli/resolve-config.ts` | Runtime type guards |
| `core/src/cli/index.ts` | Extract `parseArgs`, `resolveCommand`; JSDoc on `splitCommand`; import constants |
| `next/src/cli/resolve-config.ts` | Type guards, `next.config.cjs` candidate, env var validation |
| `next/src/cli/index.ts` | Extract `resolveAndValidateConfig`, `updatePortArg`; import constants from core |
| `next/src/plugin.ts` | `console.warn` → `log.warn` |
