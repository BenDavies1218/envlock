# Logging and Bug Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a minimal logger with `--debug`/`-d` flag to both CLIs, surface three silent-failure bugs, and replace all raw `console.warn`/`process.exit` in library code with consistent error throwing and structured logging.

**Architecture:** A singleton logger lives in `packages/core/src/logger.ts` and is imported by all internal modules in both packages. The CLIs strip `--debug`/`-d` from argv early and call `setVerbose(true)` before any other logic. `checkBinary` is changed from `process.exit(1)` to `throw new Error(...)`. `spawnSync` errors are surfaced before falling through to the exit code.

**Tech Stack:** TypeScript, Node.js built-ins only (`process.stderr.write`), Vitest for tests, Commander (next package), pnpm workspaces.

---

### Task 1: Logger module

**Files:**
- Create: `packages/core/src/logger.ts`
- Create: `packages/core/src/logger.test.ts`

**Step 1: Write the failing tests**

Create `packages/core/src/logger.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Must isolate module between tests so verbose state resets
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("log.debug", () => {
  it("does not write when verbose is false (default)", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { log } = await import("./logger.js");
    log.debug("hello");
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("writes to stderr when verbose is true", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { log, setVerbose } = await import("./logger.js");
    setVerbose(true);
    log.debug("hello");
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[envlock:debug] hello\n"));
  });
});

describe("log.warn", () => {
  it("always writes to stderr", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { log } = await import("./logger.js");
    log.warn("something wrong");
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[envlock] Warning: something wrong\n"));
  });
});

describe("log.error", () => {
  it("always writes to stderr", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { log } = await import("./logger.js");
    log.error("fatal");
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[envlock] Error: fatal\n"));
  });
});

describe("log.info", () => {
  it("always writes to stderr", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { log } = await import("./logger.js");
    log.info("running");
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[envlock] running\n"));
  });
});

describe("setVerbose", () => {
  it("can be toggled back off", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { log, setVerbose } = await import("./logger.js");
    setVerbose(true);
    setVerbose(false);
    log.debug("should not appear");
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run to verify it fails**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A3 "logger"
```

Expected: FAIL — module not found.

**Step 3: Implement the logger**

Create `packages/core/src/logger.ts`:

```ts
let verbose = false;

export function setVerbose(flag: boolean): void {
  verbose = flag;
}

export const log = {
  debug: (msg: string): void => {
    if (verbose) process.stderr.write(`[envlock:debug] ${msg}\n`);
  },
  info: (msg: string): void => {
    process.stderr.write(`[envlock] ${msg}\n`);
  },
  warn: (msg: string): void => {
    process.stderr.write(`[envlock] Warning: ${msg}\n`);
  },
  error: (msg: string): void => {
    process.stderr.write(`[envlock] Error: ${msg}\n`);
  },
};
```

**Step 4: Run to verify tests pass**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A3 "logger"
```

Expected: all logger tests PASS.

**Step 5: Commit**

```bash
git add packages/core/src/logger.ts packages/core/src/logger.test.ts
git commit -m "feat(core): add minimal logger with setVerbose and debug/info/warn/error"
```

---

### Task 2: Fix `checkBinary` to throw instead of `process.exit`

**Files:**
- Create: `packages/core/src/detect.test.ts`
- Modify: `packages/core/src/detect.ts`

**Step 1: Write the failing tests**

Create `packages/core/src/detect.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

const { execFileSync } = await import("node:child_process");
const { checkBinary, hasBinary } = await import("./detect.js");

describe("hasBinary", () => {
  it("returns true when binary is found", () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.from("/usr/bin/node\n"));
    expect(hasBinary("node")).toBe(true);
  });

  it("returns false when binary is not found", () => {
    vi.mocked(execFileSync).mockImplementation(() => { throw new Error("not found"); });
    expect(hasBinary("nonexistent-tool")).toBe(false);
  });
});

describe("checkBinary", () => {
  it("does not throw when binary exists", () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.from("/usr/bin/node\n"));
    expect(() => checkBinary("node", "install node")).not.toThrow();
  });

  it("throws an Error with the install hint when binary is missing", () => {
    vi.mocked(execFileSync).mockImplementation(() => { throw new Error("not found"); });
    expect(() => checkBinary("dotenvx", "npm install -g @dotenvx/dotenvx")).toThrow(
      /dotenvx.*not found|npm install -g @dotenvx\/dotenvx/i,
    );
  });

  it("thrown error is an instance of Error (not a process.exit)", () => {
    vi.mocked(execFileSync).mockImplementation(() => { throw new Error("not found"); });
    expect(() => checkBinary("op", "brew install 1password-cli")).toThrowError(Error);
  });
});
```

**Step 2: Run to verify it fails**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A5 "detect"
```

Expected: the `checkBinary throws` test FAILS (currently calls `process.exit`, not throw).

**Step 3: Fix `checkBinary`**

Edit `packages/core/src/detect.ts`. Replace:

```ts
export function checkBinary(name: string, installHint: string): void {
  if (!hasBinary(name)) {
    console.error(`[envlock] '${name}' not found in PATH.\n${installHint}`);
    process.exit(1);
  }
}
```

With:

```ts
import { log } from "./logger.js";

export function checkBinary(name: string, installHint: string): void {
  if (!hasBinary(name)) {
    throw new Error(`[envlock] '${name}' not found in PATH.\n${installHint}`);
  }
  log.debug(`Binary check: ${name} found`);
}
```

**Step 4: Run to verify tests pass**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A5 "detect"
```

Expected: all detect tests PASS.

**Step 5: Commit**

```bash
git add packages/core/src/detect.ts packages/core/src/detect.test.ts
git commit -m "fix(core): checkBinary throws Error instead of calling process.exit"
```

---

### Task 3: Fix `spawnSync` error surfacing in `invoke.ts`

**Files:**
- Create: `packages/core/src/invoke.test.ts`
- Modify: `packages/core/src/invoke.ts`

**Step 1: Write the failing tests**

Create `packages/core/src/invoke.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

vi.mock("./detect.js", () => ({
  checkBinary: vi.fn(),
}));

vi.mock("./logger.js", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  setVerbose: vi.fn(),
}));

const { spawnSync } = await import("node:child_process");
const { runWithSecrets } = await import("./invoke.js");

const BASE_OPTS = {
  envFile: ".env.development",
  environment: "development" as const,
  onePasswordEnvId: "test-env-id",
  command: "node",
  args: ["server.js"],
};

describe("runWithSecrets", () => {
  it("exits with the subprocess status code on success", () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0, error: undefined } as any);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    runWithSecrets({ ...BASE_OPTS, onePasswordEnvId: undefined as any });
    // checkBinary is mocked, so it won't throw — spawnSync path is reached
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });

  it("throws when spawnSync returns an error (OS-level failure)", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: null,
      error: new Error("ENOENT: op not found"),
    } as any);
    expect(() => runWithSecrets(BASE_OPTS)).toThrow(/Failed to spawn.*ENOENT/i);
  });

  it("exits with code 1 when status is null and no error", () => {
    vi.mocked(spawnSync).mockReturnValue({ status: null, error: undefined } as any);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    runWithSecrets(BASE_OPTS);
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
```

**Step 2: Run to verify the `throws` test fails**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A5 "invoke"
```

Expected: the "throws when spawnSync returns an error" test FAILS.

**Step 3: Fix `invoke.ts`**

Edit `packages/core/src/invoke.ts`. Add `import { log } from "./logger.js";` at the top.

After each `spawnSync` call (there are two — one with `op`, one without), add the error check before `process.exit`. Replace the final `process.exit(result.status ?? 1)` pattern with:

```ts
  if (result.error) {
    throw new Error(`[envlock] Failed to spawn '${keyAlreadyInjected ? "dotenvx" : "op"}': ${result.error.message}`);
  }

  process.exit(result.status ?? 1);
```

Also add a debug log before each `spawnSync` call. For the `op` path:

```ts
  log.debug(`Spawning: op run --environment ${onePasswordEnvId} -- dotenvx run -f ${envFile} -- ${command} ${args.join(" ")}`);
```

For the key-already-injected path:

```ts
  log.debug(`Spawning: dotenvx run -f ${envFile} -- ${command} ${args.join(" ")}`);
```

**Step 4: Run to verify tests pass**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A5 "invoke"
```

Expected: all invoke tests PASS.

**Step 5: Commit**

```bash
git add packages/core/src/invoke.ts packages/core/src/invoke.test.ts
git commit -m "fix(core): surface spawnSync OS-level errors instead of silent exit; add debug logging"
```

---

### Task 4: Add `--debug` flag and logging to core CLI

**Files:**
- Modify: `packages/core/src/cli/index.ts`
- Modify: `packages/core/src/cli/index.test.ts`

**Step 1: Update the existing warning spy test**

In `packages/core/src/cli/index.test.ts`, find the test "warns when config has a reserved 'run' command key" (line 174). The spy currently targets `console.warn`. After this task it must target `process.stderr.write` because `log.warn` writes there directly.

Replace:

```ts
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
await run(["run", "node", "server.js"], tmpDir);
expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"run" is a reserved subcommand'));
warnSpy.mockRestore();
```

With:

```ts
const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
await run(["run", "node", "server.js"], tmpDir);
expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('"run" is a reserved subcommand'));
stderrSpy.mockRestore();
```

Also add a new test for the `--debug` flag stripping:

```ts
it("strips --debug from argv before processing", async () => {
  process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
  await run(["--debug", "node", "server.js"], tmpDir);
  expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
    command: "node",
    args: ["server.js"],
  }));
});

it("strips -d from argv before processing", async () => {
  process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
  await run(["-d", "node", "server.js"], tmpDir);
  expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
    command: "node",
    args: ["server.js"],
  }));
});
```

**Step 2: Run to verify the updated warn test fails**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A5 "reserved"
```

Expected: the "warns when config has a reserved 'run' command key" test FAILS (still uses `console.warn`).

**Step 3: Update `packages/core/src/cli/index.ts`**

Add to the imports at the top:

```ts
import { log, setVerbose } from "../logger.js";
```

Update the `run` function signature — add debug flag stripping at the very start of `run()`, before the environment detection:

```ts
export async function run(argv: string[], cwd: string = process.cwd()): Promise<void> {
  // Strip --debug / -d and enable verbose logging
  const debugIdx = argv.findIndex((a) => a === "--debug" || a === "-d");
  if (debugIdx !== -1) {
    setVerbose(true);
    argv = argv.filter((_, i) => i !== debugIdx);
  }

  const environment: Environment = argv.includes(ARGUMENT_FLAGS.production)
    // ... rest unchanged
```

Replace the `console.warn` call in the `"run"` reserved key block with `log.warn(...)`:

```ts
log.warn(
  '"run" is a reserved subcommand. The config command named "run" is ignored.\n' +
  'Rename it in envlock.config.js to use it as a named command.',
);
```

Add debug logs just before the `runWithSecrets` call:

```ts
  log.debug(`Environment: ${environment}`);
  log.debug(`Env file: ${envFile}`);
  log.debug(`Command: ${command} ${args.join(" ")}`);

  runWithSecrets({ envFile, environment, onePasswordEnvId, command, args });
```

Update the entry-point guard block to also log the resolved path:

```ts
const _resolvedArgv1 = (() => {
  try { return realpathSync(process.argv[1] ?? ""); }
  catch { return process.argv[1] ?? ""; }
})();

if (import.meta.url === pathToFileURL(_resolvedArgv1).href) {
  // Parse --debug before handing off, so the resolved path debug line shows
  if (process.argv.includes("--debug") || process.argv.includes("-d")) {
    setVerbose(true);
  }
  log.debug(`Resolved argv[1]: ${_resolvedArgv1}`);
  run(process.argv.slice(2)).catch((err: unknown) => {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
```

**Step 4: Run to verify all core tests pass**

```bash
cd packages/core && pnpm test -- --reporter=verbose
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add packages/core/src/cli/index.ts packages/core/src/cli/index.test.ts
git commit -m "feat(core): add --debug/-d flag, structured logging, consistent error output"
```

---

### Task 5: Fix symlink bug + add `--debug` flag and logging to next CLI

**Files:**
- Modify: `packages/next/src/cli/index.ts`
- Modify: `packages/next/src/cli/index.test.ts`

**Step 1: Add a test for the `--debug` flag**

In `packages/next/src/cli/index.test.ts`, add to the `handleRunCommand` describe block:

```ts
it("does not throw when called normally (smoke test for debug-stripped import)", async () => {
  await handleRunCommand("node", ["server.js"], {});
  expect(runWithSecrets).toHaveBeenCalled();
});
```

This is mostly a smoke test — the Commander-based flag is harder to unit test directly. The important thing is the existing tests still pass after the changes.

**Step 2: Run to verify existing next tests still pass before changes**

```bash
cd packages/next && pnpm test -- --reporter=verbose
```

Expected: all PASS. This is a baseline check.

**Step 3: Fix symlink bug + add `--debug` + logging**

Edit `packages/next/src/cli/index.ts`:

Add imports at the top:

```ts
import { realpathSync } from "node:fs";
import { setVerbose, log } from "envlock-core";
```

Note: `setVerbose` and `log` must be exported from `packages/core/src/index.ts` for this import to work. Add them:

In `packages/core/src/index.ts`, add:

```ts
export { log, setVerbose } from "./logger.js";
```

Back in `packages/next/src/cli/index.ts` — add `--debug` option to the Commander program:

```ts
program
  .name("envlock")
  .description("Run Next.js commands with 1Password + dotenvx secret injection")
  .version("0.3.0")
  .enablePositionalOptions()
  .option("-d, --debug", "enable debug output");
```

Fix the symlink guard and add early verbose setup. Replace:

```ts
// Binary entry point — only runs when executed directly
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  program.parse(process.argv);
}
```

With:

```ts
// Binary entry point — only runs when executed directly.
// realpathSync resolves npm bin symlinks so import.meta.url matches process.argv[1].
const _resolvedArgv1Next = (() => {
  try { return realpathSync(process.argv[1] ?? ""); }
  catch { return process.argv[1] ?? ""; }
})();

if (import.meta.url === pathToFileURL(_resolvedArgv1Next).href) {
  // Enable debug before parse so log.debug works during subcommand dispatch
  if (process.argv.includes("--debug") || process.argv.includes("-d")) {
    setVerbose(true);
  }
  log.debug(`Resolved argv[1]: ${_resolvedArgv1Next}`);
  program.parse(process.argv);
}
```

Add debug logging inside `runNextCommand`:

```ts
async function runNextCommand(
  subcommand: Subcommand,
  environment: Environment,
  passthroughArgs: string[],
): Promise<void> {
  const config = await resolveConfig(process.cwd());
  const envFile = config.envFiles?.[environment] ?? DEFAULT_ENV_FILES[environment];
  log.debug(`Environment: ${environment}`);
  log.debug(`Env file: ${envFile}`);
  log.debug(`Command: next ${subcommand} ${passthroughArgs.join(" ")}`);
  validateEnvFilePath(envFile, process.cwd());
  runWithSecrets({ envFile, environment, onePasswordEnvId: config.onePasswordEnvId, command: "next", args: [subcommand, ...passthroughArgs] });
}
```

Also update `handleRunCommand` to use `log.debug` similarly:

```ts
  log.debug(`Environment: ${environment}`);
  log.debug(`Env file: ${envFile}`);
  log.debug(`Command: ${cmd} ${cmdArgs.join(" ")}`);
  runWithSecrets({ ... });
```

And change the `catch` block in the `runCmd` action to use `log.error`:

```ts
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
```

**Step 4: Run next tests**

```bash
cd packages/next && pnpm test -- --reporter=verbose
```

Expected: all PASS.

**Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/next/src/cli/index.ts packages/next/src/cli/index.test.ts
git commit -m "fix(next): resolve symlink in entry guard; feat(next): add --debug flag and structured logging"
```

---

### Task 6: Replace `console.warn` with `log.warn` in both `resolve-config.ts` files

**Files:**
- Modify: `packages/core/src/cli/resolve-config.ts`
- Modify: `packages/next/src/cli/resolve-config.ts`

**Step 1: Update core `resolve-config.ts`**

Add import:

```ts
import { log } from "../logger.js";
```

Replace:

```ts
console.warn(
  `[envlock] Failed to load ${candidate}: ${err instanceof Error ? err.message : String(err)}`,
);
```

With:

```ts
log.warn(`Failed to load ${candidate}: ${err instanceof Error ? err.message : String(err)}`);
log.debug(`Stack: ${err instanceof Error ? err.stack ?? "" : ""}`);
```

Also add a debug line when config is found:

```ts
// After: return config as EnvlockConfig;
log.debug(`Config loaded from ${candidate}`);
return config as EnvlockConfig;
```

**Step 2: Update next `resolve-config.ts`**

Add import:

```ts
import { log } from "envlock-core";
```

Replace:

```ts
console.warn(
  `[envlock] Failed to load ${candidate}: ${err instanceof Error ? err.message : String(err)}`,
);
```

With:

```ts
log.warn(`Failed to load ${candidate}: ${err instanceof Error ? err.message : String(err)}`);
log.debug(`Stack: ${err instanceof Error ? err.stack ?? "" : ""}`);
```

Add a debug line when config is found:

```ts
// After: return config.__envlock as EnvlockOptions;
log.debug(`Config loaded from ${candidate}`);
return config.__envlock as EnvlockOptions;
```

**Step 3: Run full test suite**

```bash
pnpm test
```

Expected: all tests in both packages PASS.

**Step 4: Build to verify compilation**

```bash
pnpm build
```

Expected: clean build with no type errors.

**Step 5: Commit**

```bash
git add packages/core/src/cli/resolve-config.ts packages/next/src/cli/resolve-config.ts
git commit -m "refactor: replace console.warn with log.warn in resolve-config; add debug logging for config load"
```

---

## Verification

After all tasks, manually verify the end-to-end experience:

```bash
# Should print all [envlock:debug] lines before running the command
node packages/core/dist/cli/index.js --debug run echo hello

# Should be completely silent on the envlock side
node packages/core/dist/cli/index.js run echo hello
```

Expected debug output:

```
[envlock:debug] Resolved argv[1]: /path/to/packages/core/dist/cli/index.js
[envlock:debug] Environment: development
[envlock:debug] Env file: .env.development
[envlock:debug] Command: echo hello
```
