# Loading Spinner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a zero-dependency terminal spinner to `envlock-core` that shows progress during the `op run` (1Password) and dotenvx decrypt phases of `runWithSecrets`.

**Architecture:** A private `spinner.ts` module in `packages/core/src/` exposes a single spinner instance with `start/stop/fail` methods using `setInterval` + ANSI escape codes. It is called directly inside `runWithSecrets` in `invoke.ts`. It is a no-op when `process.stderr.isTTY` is falsy so CI/piped output is unaffected.

**Tech Stack:** TypeScript, Node.js `process.stderr`, `setInterval`/`clearInterval`, ANSI escape codes (`\r`, `\x1b[K`)

---

### Task 1: Create `spinner.ts` with failing test

**Files:**
- Create: `packages/core/src/spinner.ts`
- Create: `packages/core/src/test/spinner.test.ts`

**Step 1: Write the failing test**

Add to `packages/core/src/test/spinner.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spinner } from "../spinner.js";

describe("spinner", () => {
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    stderrWrite.mockRestore();
    vi.useRealTimers();
    spinner.stop(); // ensure clean state
  });

  it("is a no-op when stderr is not a TTY", () => {
    // isTTY is undefined in test environment (non-TTY)
    spinner.start("Loading…");
    vi.advanceTimersByTime(200);
    spinner.stop();
    expect(stderrWrite).not.toHaveBeenCalled();
  });

  it("writes frames to stderr when TTY", () => {
    Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
    spinner.start("Loading…");
    vi.advanceTimersByTime(160); // two ticks at 80ms
    expect(stderrWrite).toHaveBeenCalled();
    const calls = stderrWrite.mock.calls.map((c) => c[0] as string);
    expect(calls.some((s) => s.includes("Loading…"))).toBe(true);
    Object.defineProperty(process.stderr, "isTTY", { value: undefined, configurable: true });
    spinner.stop();
  });

  it("clears the line on stop when TTY", () => {
    Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
    spinner.start("Loading…");
    vi.advanceTimersByTime(80);
    spinner.stop();
    const calls = stderrWrite.mock.calls.map((c) => c[0] as string);
    expect(calls.some((s) => s.includes("\x1b[K"))).toBe(true);
    Object.defineProperty(process.stderr, "isTTY", { value: undefined, configurable: true });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test -- spinner
```

Expected: FAIL — `../spinner.js` cannot be found.

**Step 3: Implement `spinner.ts`**

Create `packages/core/src/spinner.ts`:

```ts
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL_MS = 80;

function isTTY(): boolean {
  return !!process.stderr.isTTY;
}

let timer: ReturnType<typeof setInterval> | null = null;
let frameIndex = 0;

export const spinner = {
  start(msg: string): void {
    if (!isTTY()) return;
    frameIndex = 0;
    timer = setInterval(() => {
      const frame = FRAMES[frameIndex % FRAMES.length]!;
      process.stderr.write(`\r${frame} ${msg}`);
      frameIndex++;
    }, INTERVAL_MS);
  },

  stop(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (!isTTY()) return;
    process.stderr.write("\r\x1b[K");
  },

  fail(msg: string): void {
    this.stop();
    if (!isTTY()) return;
    process.stderr.write(`[envlock] Error: ${msg}\n`);
  },
};
```

**Step 4: Run test to verify it passes**

```bash
cd packages/core && pnpm test -- spinner
```

Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add packages/core/src/spinner.ts packages/core/src/test/spinner.test.ts
git commit -m "feat(core): add zero-dependency terminal spinner"
```

---

### Task 2: Integrate spinner into `runWithSecrets`

**Files:**
- Modify: `packages/core/src/invoke.ts`

**Step 1: Read the current file**

Open `packages/core/src/invoke.ts` and confirm the two phases:
1. The `!keyAlreadyInjected` branch that calls `spawnSync("op", [...])`
2. The `await import("@dotenvx/dotenvx")` + `config({ path: envFile })` call

**Step 2: Add spinner import and wrap both phases**

Edit `packages/core/src/invoke.ts` — add the import at the top and wrap both phases:

```ts
import { spawnSync } from "node:child_process";
import { checkBinary } from "./detect.js";
import { log } from "./logger.js";
import { spinner } from "./spinner.js";   // ← add this
import type { Environment } from "./types.js";
```

Replace the `!keyAlreadyInjected` block:

```ts
  if (!keyAlreadyInjected) {
    checkBinary(
      "op",
      "Install 1Password CLI: brew install --cask 1password-cli@beta\nThen sign in: op signin",
    );
    log.debug(`Re-invoking via: op run --environment ${onePasswordEnvId}`);
    spinner.start("Fetching secrets from 1Password…");
    spinner.stop(); // must clear before spawnSync with stdio: "inherit"
    const result = spawnSync(
      "op",
      [
        "run",
        "--environment",
        onePasswordEnvId,
        "--",
        process.execPath,
        ...process.execArgv,
        process.argv[1]!,
        ...process.argv.slice(2),
      ],
      { stdio: "inherit" },
    );
    if (result.error) {
      throw new Error(`[envlock] Failed to spawn 'op': ${result.error.message}`);
    }
    process.exit(result.status ?? 1);
    return;
  }
```

Replace the dotenvx block:

```ts
  log.debug(`Decrypting ${envFile} via dotenvx`);
  spinner.start("Decrypting .env file…");
  try {
    const { config } = await import("@dotenvx/dotenvx");
    config({ path: envFile });
  } finally {
    spinner.stop();
  }
```

**Step 3: Run existing invoke tests to verify nothing broke**

```bash
cd packages/core && pnpm test -- invoke
```

Expected: All existing tests PASS.

**Step 4: Commit**

```bash
git add packages/core/src/invoke.ts
git commit -m "feat(core): show spinner during op run and dotenvx phases"
```

---

### Task 3: Build and verify

**Step 1: Build the core package**

```bash
cd packages/core && pnpm build
```

Expected: No TypeScript errors. `dist/` updated.

**Step 2: Run full test suite**

```bash
cd packages/core && pnpm test
```

Expected: All tests PASS.

**Step 3: Commit if any build artifacts changed**

Only commit if the build produced unexpected changes. Otherwise this task is done.
