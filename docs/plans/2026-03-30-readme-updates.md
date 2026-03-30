# README Updates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix gaps and add missing documentation across all three README files so that both npm consumers and contributors have accurate, complete information.

**Architecture:** Pure documentation changes — no code modifications. Each task edits one file, verifies visually, and commits. Order: root README first (defines shared security model prose), then packages (reference root).

**Tech Stack:** Markdown, Git

---

### Task 1: Fix root `README.md` — repair broken heading and add Security model

**Files:**
- Modify: `README.md`

**Step 1: Open the file and locate the broken line**

In `README.md`, find:
```
## ![envlock runtime flow](./envlock_runtime_flow.svg)
```
This merges the `##` heading marker with the image tag, so "How it works" never renders and the SVG never displays correctly.

**Step 2: Fix the heading and image**

Replace:
```markdown
## How it works

## ![envlock runtime flow](./envlock_runtime_flow.svg)
```
With:
```markdown
## How it works

![envlock runtime flow](./envlock_runtime_flow.svg)
```

**Step 3: Add the Security model section**

Insert the following section immediately after the image line (before `## envlock-next`):

```markdown
## Security model

envlock injects secrets in two phases so they never appear in shell history, CI environment variables, or unencrypted files:

1. **`op run` phase** — envlock re-invokes itself wrapped inside `op run --environment <id>`. The 1Password CLI resolves your secrets and injects `DOTENV_PRIVATE_KEY_<ENV>` into the child process environment, then hands control back.
2. **`dotenvx` phase** — the re-invoked process detects `DOTENV_PRIVATE_KEY_<ENV>` already set, skips `op run`, and calls the `dotenvx` JS API in-process to decrypt the encrypted `.env.*` file. The target command is then spawned with secrets in its environment.

In CI, set `DOTENV_PRIVATE_KEY_<ENV>` directly (e.g. from a vault secret). envlock detects it and skips the `op run` phase entirely.
```

**Step 4: Verify the full file renders correctly**

Read through `README.md` end-to-end and confirm:
- "How it works" is a `##` heading
- The SVG image tag is on its own line beneath it
- "Security model" appears as a `##` heading before "envlock-next"
- No duplicate headings

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: fix How it works heading and add Security model section"
```

---

### Task 2: Update `packages/next/README.md`

**Files:**
- Modify: `packages/next/README.md`

**Step 1: Add `next.config.mjs` to the Setup section**

Find the "Configure `next.config.js`" heading in the Setup section. Change the heading to:

```markdown
### 1. Configure `next.config.js` / `next.config.ts` / `next.config.mjs`
```

**Step 2: Add `envlock run` subcommand docs**

Find the existing Usage section:
```markdown
## Environment flags
```

Insert a new `## Run any command` section before it:

```markdown
## Run any command

Use `envlock run` to inject secrets into any arbitrary command:

```bash
envlock run node migrate.js
envlock run curl https://api.example.com --staging
envlock run <command> [args...] --production
```

`--staging` and `--production` flags work the same as with `dev`/`build`/`start`.

---
```

**Step 3: Add `-d, --debug` to the existing debug section**

Find:
```markdown
**Debug output:**

```bash
envlock dev --debug
```
```

Replace with:
```markdown
**Debug output:**

```bash
envlock dev --debug
envlock dev -d
```
```

**Step 4: Add "How it works" section**

Insert a new section before `## License`:

```markdown
## How it works

envlock uses a two-phase secret injection model — see [Security model](../../README.md#security-model) in the root README for a full explanation.
```

**Step 5: Verify the file**

Read through `packages/next/README.md` end-to-end and confirm all new sections are present and correctly placed.

**Step 6: Commit**

```bash
git add packages/next/README.md
git commit -m "docs(next): add run subcommand, debug flag, mjs config, and security model link"
```

---

### Task 3: Update `packages/core/README.md`

**Files:**
- Modify: `packages/core/README.md`

**Step 1: Add `setVerbose` to the API section**

Find the `## API` section. After the last documented export (`checkBinary`), add:

```markdown
### `setVerbose(verbose: boolean)`

Enables or disables debug-level log output. When `true`, envlock logs the resolved config path, environment, env file, and spawned command to stderr. Called automatically when `--debug` / `-d` is passed on the CLI.
```

**Step 2: Document the `run` reserved subcommand warning**

Find the `### envlock.config.js` section. After the config example block, add a note:

```markdown
> **Note:** `run` is a reserved subcommand name. If you define a command named `"run"` in `envlock.config.js`, it will be ignored with a warning. Rename it to something else (e.g. `migrate`) to use it as a named command.
```

**Step 3: Add "How it works" section**

Insert a new section before `## License`:

```markdown
## How it works

envlock uses a two-phase secret injection model — see [Security model](../../README.md#security-model) in the root README for a full explanation.
```

**Step 4: Verify the file**

Read through `packages/core/README.md` end-to-end and confirm all changes are present and correctly placed.

**Step 5: Commit**

```bash
git add packages/core/README.md
git commit -m "docs(core): add setVerbose API, run reserved warning, and security model link"
```
