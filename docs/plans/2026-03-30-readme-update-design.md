# README Update Design — 2026-03-30

## Goal

Update all three README files (`README.md`, `packages/next/README.md`, `packages/core/README.md`) for both npm consumers and contributors. Approach: fix known gaps and fill undocumented behaviour without restructuring.

## Scope

### Root `README.md`

**Fixes:**
- Repair the broken `## ![envlock runtime flow]` line so "How it works" renders as a heading and the SVG renders as an image beneath it.

**Additions:**
- Add a **Security model** section after "How it works" explaining the two-phase injection:
  1. `op run` wraps the process and injects `DOTENV_PRIVATE_KEY_<ENV>` into the environment.
  2. The re-invoked process detects the key, calls `dotenvx` in-process to decrypt the env file, then spawns the target command.
  - Result: no secrets touch shell history, CI environment variables, or unencrypted files.

### `packages/next/README.md`

**Fixes:**
- Add `next.config.mjs` to the list of supported config file formats (`resolveConfig` checks `.ts`, `.js`, `.mjs`).
- Add `-d, --debug` flag to the CLI usage section.

**Additions:**
- Document `envlock run <command> [args...]` with `--staging` / `--production` flag support.
- Add a brief "How it works" paragraph linking to the root README security model.

### `packages/core/README.md`

**Fixes:**
- Add `setVerbose(verbose: boolean)` to the API section (exported from `index.ts`, undocumented).

**Additions:**
- Document the `run` reserved subcommand: if `envlock.config.js` defines a command named `"run"`, it is ignored with a warning. Users should rename it.
- Add a brief "How it works" paragraph linking to the root README security model, consistent with the next package.

## Out of scope

- Restructuring or reordering existing sections.
- Adding new examples beyond what is needed to explain the gaps above.
- Updating `CONTRIBUTORS.md` or `CODEOWNERS`.
