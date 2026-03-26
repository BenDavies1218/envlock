# envlock-core CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an `envlock` binary to `envlock-core` that reads `envlock.config.ts`, resolves environment from `--staging`/`--production` flags, and runs the user's named or ad-hoc command with secrets injected.

**Architecture:** Three new files — `EnvlockConfig` type added to `types.ts`, `src/cli/resolve-config.ts` loads `envlock.config.ts/.js/.mjs` from cwd, `src/cli/index.ts` is the binary entry point. `tsup.config.ts` and `package.json` updated to build and expose the binary.

**Tech Stack:** TypeScript, Commander, Vitest, tsup. No new dependencies — `commander` already in `envlock-next`; add it to `envlock-core`.

---

### Task 1: Add `EnvlockConfig` type and `commander` dependency

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/package.json`

**Step 1: Add `EnvlockConfig` interface to `packages/core/src/types.ts`**

Append after the existing `EnvlockOptions` interface:

```ts
export interface EnvlockConfig {
  onePasswordEnvId?: string;
  envFiles?: Partial<Record<Environment, string>>;
  commands?: Record<string, string>;
}
```

**Step 2: Export `EnvlockConfig` from `packages/core/src/index.ts`**

Add to the existing export line for types:

```ts
export type { Environment, EnvlockOptions, EnvlockConfig } from "./types.js";
```

**Step 3: Add `commander` to dependencies in `packages/core/package.json`**

```json
"dependencies": {
  "commander": "^12.0.0"
}
```

**Step 4: Run install**

```bash
pnpm install
```

**Step 5: Run tests to confirm nothing broken**

```bash
cd packages/core && pnpm test
```

Expected: all 11 tests pass.

**Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core): add EnvlockConfig type and commander dependency"
```

---

### Task 2: Write `resolve-config.ts` with tests

**Files:**
- Create: `packages/core/src/cli/resolve-config.ts`
- Create: `packages/core/src/cli/resolve-config.test.ts`

**Step 1: Write the failing tests first**

Create `packages/core/src/cli/resolve-config.test.ts`:

```ts
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveConfig } from "./resolve-config.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `envlock-core-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  delete process.env["ENVLOCK_OP_ENV_ID"];
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env["ENVLOCK_OP_ENV_ID"];
});

describe("resolveConfig", () => {
  it("returns null when no config file and no env var", async () => {
    const config = await resolveConfig(tmpDir);
    expect(config).toBeNull();
  });

  it("reads onePasswordEnvId from envlock.config.js", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "test-id", commands: { dev: "node server.js" } };`,
    );
    const config = await resolveConfig(tmpDir);
    expect(config?.onePasswordEnvId).toBe("test-id");
  });

  it("reads commands from config", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "test-id", commands: { dev: "node server.js --watch", start: "node server.js" } };`,
    );
    const config = await resolveConfig(tmpDir);
    expect(config?.commands?.dev).toBe("node server.js --watch");
    expect(config?.commands?.start).toBe("node server.js");
  });

  it("reads envFiles from config", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "test-id", envFiles: { production: ".env.prod" } };`,
    );
    const config = await resolveConfig(tmpDir);
    expect(config?.envFiles?.production).toBe(".env.prod");
  });

  it("prefers envlock.config.js over envlock.config.mjs", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "from-js" };`,
    );
    writeFileSync(
      join(tmpDir, "envlock.config.mjs"),
      `export default { onePasswordEnvId: "from-mjs" };`,
    );
    const config = await resolveConfig(tmpDir);
    expect(config?.onePasswordEnvId).toBe("from-js");
  });

  it("falls back to envlock.config.mjs when .js absent", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.mjs"),
      `export default { onePasswordEnvId: "from-mjs" };`,
    );
    const config = await resolveConfig(tmpDir);
    expect(config?.onePasswordEnvId).toBe("from-mjs");
  });

  it("warns and skips config with a syntax error", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { this is not valid javascript }`,
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const config = await resolveConfig(tmpDir);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("envlock.config.js"));
    expect(config).toBeNull();
    warn.mockRestore();
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd packages/core && pnpm test
```

Expected: failures — `resolve-config.js` not found.

**Step 3: Implement `packages/core/src/cli/resolve-config.ts`**

```ts
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { EnvlockConfig } from "../types.js";

const CONFIG_CANDIDATES = [
  "envlock.config.js",
  "envlock.config.mjs",
  "envlock.config.ts",
];

export async function resolveConfig(cwd: string): Promise<EnvlockConfig | null> {
  for (const candidate of CONFIG_CANDIDATES) {
    const fullPath = resolve(cwd, candidate);
    if (!existsSync(fullPath)) continue;

    try {
      const mod = await import(pathToFileURL(fullPath).href);
      const config = (mod as Record<string, unknown>).default ?? mod;
      if (config && typeof config === "object") {
        return config as EnvlockConfig;
      }
    } catch (err) {
      console.warn(
        `[envlock] Failed to load ${candidate}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return null;
}
```

**Step 4: Run tests**

```bash
cd packages/core && pnpm test
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add packages/core/src/cli/resolve-config.ts packages/core/src/cli/resolve-config.test.ts
git commit -m "feat(core): add CLI config resolver"
```

---

### Task 3: Write the `cli/index.ts` binary with tests

**Files:**
- Create: `packages/core/src/cli/index.ts`
- Create: `packages/core/src/cli/index.test.ts`

**Step 1: Write the failing tests**

Create `packages/core/src/cli/index.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../invoke.js", () => ({
  runWithSecrets: vi.fn(),
}));
vi.mock("../validate.js", () => ({
  validateEnvFilePath: vi.fn(),
  validateOnePasswordEnvId: vi.fn(),
}));

const { runWithSecrets } = await import("../invoke.js");
const { run } = await import("./index.js");

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `envlock-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  vi.clearAllMocks();
  delete process.env["ENVLOCK_OP_ENV_ID"];
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env["ENVLOCK_OP_ENV_ID"];
});

describe("run", () => {
  it("runs ad-hoc command with development env by default", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    await run(["node", "server.js"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js"],
      environment: "development",
    }));
  });

  it("uses production env with --production flag", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    await run(["node", "server.js", "--production"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      environment: "production",
    }));
  });

  it("uses staging env with --staging flag", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    await run(["node", "server.js", "--staging"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      environment: "staging",
    }));
  });

  it("resolves named command from config", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "cfg-id", commands: { dev: "node server.js --watch" } };`,
    );
    await run(["dev"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js", "--watch"],
      environment: "development",
    }));
  });

  it("resolves named command with --production flag", async () => {
    writeFileFS(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "cfg-id", commands: { start: "node server.js --port 3000" } };`,
    );
    await run(["start", "--production"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js", "--port", "3000"],
      environment: "production",
    }));
  });

  it("throws when named command not found in config", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "cfg-id", commands: { dev: "node server.js" } };`,
    );
    await expect(run(["unknown"], tmpDir)).rejects.toThrow(/available/i);
  });

  it("throws when no onePasswordEnvId anywhere", async () => {
    await expect(run(["node", "server.js"], tmpDir)).rejects.toThrow(/onePasswordEnvId/i);
  });

  it("uses custom envFile from config", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "cfg-id", envFiles: { production: ".env.prod" }, commands: { start: "node server.js" } };`,
    );
    await run(["start", "--production"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      envFile: ".env.prod",
    }));
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd packages/core && pnpm test
```

Expected: failures — `./index.js` not found, `writeFileFS` typo will also surface.

**Step 3: Fix typo in test — `writeFileFS` → `writeFileSync` (line with `start` command test)**

**Step 4: Implement `packages/core/src/cli/index.ts`**

```ts
import { ENVIRONMENTS } from "../types.js";
import type { Environment } from "../types.js";
import { runWithSecrets } from "../invoke.js";
import { validateEnvFilePath, validateOnePasswordEnvId } from "../validate.js";
import { resolveConfig } from "./resolve-config.js";

const ARGUMENT_FLAGS = {
  staging: "--staging",
  production: "--production",
} as const;

const DEFAULT_ENV_FILES: Record<Environment, string> = {
  development: ".env.development",
  staging: ".env.staging",
  production: ".env.production",
};

export async function run(argv: string[], cwd: string = process.cwd()): Promise<void> {
  const flags = argv;

  const environment: Environment = flags.includes(ARGUMENT_FLAGS.production)
    ? ENVIRONMENTS.production
    : flags.includes(ARGUMENT_FLAGS.staging)
    ? ENVIRONMENTS.staging
    : ENVIRONMENTS.development;

  const passthrough = flags.filter(
    (f) => f !== ARGUMENT_FLAGS.staging && f !== ARGUMENT_FLAGS.production,
  );

  const config = await resolveConfig(cwd);

  const firstArg = passthrough[0];
  let command: string;
  let args: string[];

  if (firstArg && config?.commands && firstArg in config.commands) {
    const cmdString = config.commands[firstArg] as string;
    const parts = cmdString.split(" ");
    command = parts[0] as string;
    args = parts.slice(1);
  } else if (passthrough.length >= 1) {
    command = firstArg as string;
    args = passthrough.slice(1);
  } else if (config?.commands) {
    throw new Error(
      `[envlock] No command specified. Available commands: ${Object.keys(config.commands).join(", ")}`,
    );
  } else {
    throw new Error("[envlock] No command specified.");
  }

  if (firstArg && config?.commands && !(firstArg in config.commands) && passthrough.length === 0) {
    throw new Error(
      `[envlock] Unknown command "${firstArg}". Available: ${Object.keys(config.commands).join(", ")}`,
    );
  }

  const onePasswordEnvId =
    process.env["ENVLOCK_OP_ENV_ID"] ?? config?.onePasswordEnvId;

  if (!onePasswordEnvId) {
    throw new Error(
      "[envlock] No onePasswordEnvId found. Set it in envlock.config.js or via ENVLOCK_OP_ENV_ID env var.",
    );
  }

  validateOnePasswordEnvId(onePasswordEnvId);

  const envFile = config?.envFiles?.[environment] ?? DEFAULT_ENV_FILES[environment];
  validateEnvFilePath(envFile, cwd);

  runWithSecrets({ envFile, environment, onePasswordEnvId, command, args });
}

// Binary entry point
if (process.argv[1]?.endsWith("cli/index.js")) {
  run(process.argv.slice(2)).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
```

**Step 5: Run tests**

```bash
cd packages/core && pnpm test
```

Expected: all tests pass. If the "throws when named command not found" test is tricky, trace through the logic — the error path fires when `passthrough.length === 0` and the command isn't in config.

**Step 6: Commit**

```bash
git add packages/core/src/cli/index.ts packages/core/src/cli/index.test.ts
git commit -m "feat(core): add envlock CLI binary"
```

---

### Task 4: Wire up build and binary in package.json

**Files:**
- Modify: `packages/core/tsup.config.ts`
- Modify: `packages/core/package.json`

**Step 1: Update `packages/core/tsup.config.ts` to build the CLI entry**

```ts
import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
    outDir: "dist",
  },
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    dts: false,
    clean: false,
    outDir: "dist",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
```

**Step 2: Add `bin` and update `files` in `packages/core/package.json`**

Add `bin` field:
```json
"bin": {
  "envlock": "./dist/cli/index.js"
},
```

**Step 3: Build**

```bash
cd packages/core && pnpm build
```

Expected: `dist/index.js`, `dist/index.d.ts`, and `dist/cli/index.js` all emitted with no errors.

**Step 4: Run all tests**

```bash
pnpm --recursive test
```

Expected: all pass.

**Step 5: Commit**

```bash
git add packages/core/tsup.config.ts packages/core/package.json
git commit -m "chore(core): expose envlock binary and add CLI to build"
```

---

### Task 5: Update README

**Files:**
- Modify: `packages/core/README.md`

**Step 1: Replace the Usage section with the new CLI-first pattern**

Replace everything between `## Usage` and `## API` with:

```markdown
## Usage

### `package.json` setup

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

Then wire up your scripts:

```json
{
  "scripts": {
    "dev":   "envlock dev",
    "build": "envlock build --production",
    "start": "envlock start --production"
  }
}
```

`--staging` and `--production` flags override the default environment (`development`). For ad-hoc use, pass the command directly:

```bash
envlock node server.js --production
```

Set `ENVLOCK_OP_ENV_ID` to provide the 1Password Environment ID via env var instead of the config file. In CI, set `DOTENV_PRIVATE_KEY_<ENV>` directly and `op run` is skipped automatically.
```

**Step 2: Commit**

```bash
git add packages/core/README.md
git commit -m "docs(core): update README with CLI usage"
```
