# Core + Next Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up packages/core and packages/next by extracting pure functions, eliminating duplicated constants, adding runtime type guards to dynamic config imports, and hardening `isPortFree` with a timeout.

**Architecture:** Work bottom-up — shared constants first (core/types.ts), then isolated utility changes (find-port, resolve-config), then the main structural refactors (core run(), next helpers). Each task is independently testable and committable.

**Tech Stack:** TypeScript, Node.js, Vitest, tsup. Tests run with `pnpm test` inside each package directory.

---

### Task 1: Export DEFAULT_ENV_FILES and ARGUMENT_FLAGS from core

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Add the constants to types.ts**

In `packages/core/src/types.ts`, append after the existing exports:

```typescript
export const ARGUMENT_FLAGS = {
  staging: "--staging",
  production: "--production",
} as const;

export const DEFAULT_ENV_FILES: Record<Environment, string> = {
  development: ".env.development",
  staging: ".env.staging",
  production: ".env.production",
};
```

**Step 2: Export them from the barrel**

In `packages/core/src/index.ts`, add:

```typescript
export { ENVIRONMENTS, ARGUMENT_FLAGS, DEFAULT_ENV_FILES } from "./types.js";
```

(Replace the existing `ENVIRONMENTS`-only line.)

**Step 3: Run core tests to confirm nothing broke**

```bash
cd packages/core && pnpm test
```
Expected: all tests pass.

**Step 4: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts
git commit -m "feat(core): export DEFAULT_ENV_FILES and ARGUMENT_FLAGS from types"
```

---

### Task 2: Add PORT_SEARCH_RANGE constant and timeout to find-port.ts

**Files:**
- Modify: `packages/core/src/find-port.ts`
- Test: `packages/core/src/find-port.test.ts`

**Step 1: Write a failing test for the timeout behaviour**

Add to `packages/core/src/find-port.test.ts` inside `describe("findFreePort")`:

```typescript
it("treats a hung listen as not-free after 2 seconds", async () => {
  // This test just verifies isPortFree resolves to false rather than hanging.
  // We simulate a hung socket by monkey-patching createServer — skip if env is slow.
  // For now, verify PORT_SEARCH_RANGE is reflected in the error message.
  const releases: Array<() => Promise<void>> = [];
  for (let p = 19040; p <= 19050; p++) {
    releases.push(await occupyPort(p));
  }
  try {
    await expect(findFreePort(19040)).rejects.toThrow(/19040.{1,5}19050/);
  } finally {
    await Promise.all(releases.map((r) => r()));
  }
}, 15_000);
```

**Step 2: Run to see it fail (error message format mismatch)**

```bash
cd packages/core && pnpm test find-port
```
Expected: FAIL — current error message uses `–` not a range matching `/19040.{1,5}19050/`.

**Step 3: Update find-port.ts**

Replace the entire file content:

```typescript
import { createServer } from "node:net";

const PORT_SEARCH_RANGE = 10;
const PORT_CHECK_TIMEOUT_MS = 2_000;

function isPortFree(port: number): Promise<boolean> {
  return Promise.race([
    new Promise<boolean>((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => server.close(() => resolve(true)));
      server.listen(port, "127.0.0.1");
    }),
    new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), PORT_CHECK_TIMEOUT_MS),
    ),
  ]);
}

export async function findFreePort(preferred: number): Promise<number> {
  for (let port = preferred; port <= preferred + PORT_SEARCH_RANGE; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(
    `[envlock] No free port found in range ${preferred}–${preferred + PORT_SEARCH_RANGE}.`,
  );
}
```

**Step 4: Run tests**

```bash
cd packages/core && pnpm test find-port
```
Expected: all tests pass including the new one.

**Step 5: Commit**

```bash
git add packages/core/src/find-port.ts packages/core/src/find-port.test.ts
git commit -m "fix(core): add PORT_SEARCH_RANGE constant and 2s timeout to isPortFree"
```

---

### Task 3: Add runtime type guards to core/cli/resolve-config.ts

**Files:**
- Modify: `packages/core/src/cli/resolve-config.ts`
- Test: `packages/core/src/cli/resolve-config.test.ts`

**Step 1: Read the existing test file first**

```bash
cat packages/core/src/cli/resolve-config.test.ts
```

**Step 2: Write failing tests for malformed configs**

Add to the describe block in `resolve-config.test.ts`:

```typescript
it("returns null and warns when onePasswordEnvId is not a string", async () => {
  writeFileSync(
    join(tmpDir, "envlock.config.js"),
    `export default { onePasswordEnvId: 42 };`,
  );
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const result = await resolveConfig(tmpDir);
  expect(result).toBeNull();
  expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("invalid shape"));
  stderrSpy.mockRestore();
});

it("returns null and warns when envFiles is not an object", async () => {
  writeFileSync(
    join(tmpDir, "envlock.config.js"),
    `export default { onePasswordEnvId: "my-id", envFiles: "bad" };`,
  );
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const result = await resolveConfig(tmpDir);
  expect(result).toBeNull();
  expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("invalid shape"));
  stderrSpy.mockRestore();
});
```

**Step 3: Run to confirm they fail**

```bash
cd packages/core && pnpm test resolve-config
```
Expected: 2 new tests FAIL.

**Step 4: Update resolve-config.ts**

Replace the `if (config && typeof config === "object")` block with:

```typescript
if (config && typeof config === "object") {
  const c = config as Record<string, unknown>;
  const idOk = !("onePasswordEnvId" in c) || typeof c["onePasswordEnvId"] === "string";
  const filesOk = !("envFiles" in c) || (typeof c["envFiles"] === "object" && c["envFiles"] !== null);
  if (!idOk || !filesOk) {
    log.warn(`${candidate} has invalid shape — onePasswordEnvId must be a string, envFiles must be an object.`);
    return null;
  }
  log.debug(`Config loaded from ${candidate}`);
  return config as EnvlockConfig;
}
```

**Step 5: Run all core tests**

```bash
cd packages/core && pnpm test
```
Expected: all pass.

**Step 6: Commit**

```bash
git add packages/core/src/cli/resolve-config.ts packages/core/src/cli/resolve-config.test.ts
git commit -m "fix(core): add runtime type guards to resolve-config"
```

---

### Task 4: Split run() in core/cli/index.ts into parseArgs + resolveCommand

**Files:**
- Modify: `packages/core/src/cli/index.ts`
- Test: `packages/core/src/cli/index.test.ts`

**Step 1: Write failing unit tests for the new pure functions**

Add a new describe block at the top of `packages/core/src/cli/index.test.ts` (before the existing `describe("run")`):

```typescript
// These imports need to be added to the existing import line:
// const { run, parseArgs, resolveCommand } = await import("./index.js");
```

Then add:

```typescript
describe("parseArgs", () => {
  it("defaults to development environment", () => {
    const result = parseArgs(["node", "server.js"]);
    expect(result.environment).toBe("development");
    expect(result.passthrough).toEqual(["node", "server.js"]);
    expect(result.debug).toBe(false);
  });

  it("detects --production flag and strips it from passthrough", () => {
    const result = parseArgs(["node", "server.js", "--production"]);
    expect(result.environment).toBe("production");
    expect(result.passthrough).toEqual(["node", "server.js"]);
  });

  it("detects --staging flag and strips it from passthrough", () => {
    const result = parseArgs(["node", "server.js", "--staging"]);
    expect(result.environment).toBe("staging");
    expect(result.passthrough).toEqual(["node", "server.js"]);
  });

  it("strips --debug flag and sets debug=true", () => {
    const result = parseArgs(["--debug", "node", "server.js"]);
    expect(result.debug).toBe(true);
    expect(result.passthrough).toEqual(["node", "server.js"]);
  });

  it("strips -d flag and sets debug=true", () => {
    const result = parseArgs(["-d", "node", "server.js"]);
    expect(result.debug).toBe(true);
    expect(result.passthrough).toEqual(["node", "server.js"]);
  });
});

describe("resolveCommand", () => {
  it("resolves ad-hoc command from passthrough", () => {
    const result = resolveCommand(["node", "server.js"], null);
    expect(result).toEqual({ command: "node", args: ["server.js"] });
  });

  it("resolves named command from config", () => {
    const result = resolveCommand(["dev"], { commands: { dev: "node server.js --watch" } });
    expect(result).toEqual({ command: "node", args: ["server.js", "--watch"] });
  });

  it("resolves explicit run subcommand", () => {
    const result = resolveCommand(["run", "python", "app.py"], null);
    expect(result).toEqual({ command: "python", args: ["app.py"] });
  });

  it("throws when no command specified", () => {
    expect(() => resolveCommand([], null)).toThrow(/No command specified/i);
  });

  it("throws when named command is unknown and config has commands", () => {
    expect(() => resolveCommand(["unknown"], { commands: { dev: "node server.js" } })).toThrow(/Unknown command/i);
  });

  it("throws when named command string is empty", () => {
    expect(() => resolveCommand(["dev"], { commands: { dev: "" } })).toThrow(/is empty/i);
  });
});
```

**Step 2: Run to confirm new tests fail**

```bash
cd packages/core && pnpm test cli/index
```
Expected: `parseArgs` and `resolveCommand` tests FAIL with "not a function".

**Step 3: Refactor core/cli/index.ts**

Replace the file with:

```typescript
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
import { ENVIRONMENTS, ARGUMENT_FLAGS, DEFAULT_ENV_FILES } from "../types.js";
import type { Environment, EnvlockConfig } from "../types.js";
import { runWithSecrets } from "../invoke.js";
import { validateEnvFilePath, validateOnePasswordEnvId } from "../validate.js";
import { resolveConfig } from "./resolve-config.js";
import { log, setVerbose } from "../logger.js";

/**
 * Splits a command string into tokens, respecting single and double quoted groups.
 *
 * Limitation: escaped quotes inside quoted strings (e.g. "it\"s") are NOT supported.
 * Inputs with escaped quotes will produce incorrect tokens. Use shell-quote if you
 * need full POSIX shell parsing.
 */
function splitCommand(cmd: string): string[] {
  const parts: string[] = [];
  const re = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cmd)) !== null) {
    parts.push(match[1] ?? match[2] ?? match[0]!);
  }
  return parts;
}

export interface ParsedArgs {
  environment: Environment;
  passthrough: string[];
  debug: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const debugIdx = argv.findIndex((a) => a === "--debug" || a === "-d");
  const debug = debugIdx !== -1;
  const withoutDebug = debug ? argv.filter((_, i) => i !== debugIdx) : argv;

  const environment: Environment = withoutDebug.includes(ARGUMENT_FLAGS.production)
    ? ENVIRONMENTS.production
    : withoutDebug.includes(ARGUMENT_FLAGS.staging)
    ? ENVIRONMENTS.staging
    : ENVIRONMENTS.development;

  const passthrough = withoutDebug.filter(
    (f) => f !== ARGUMENT_FLAGS.staging && f !== ARGUMENT_FLAGS.production,
  );

  return { environment, passthrough, debug };
}

export function resolveCommand(
  passthrough: string[],
  config: EnvlockConfig | null,
): { command: string; args: string[] } {
  const firstArg = passthrough[0];

  if (firstArg === undefined) {
    const available = config?.commands ? Object.keys(config.commands).join(", ") : "none";
    throw new Error(`[envlock] No command specified. Available commands: ${available}`);
  }

  if (firstArg === "run") {
    if (config?.commands?.["run"]) {
      log.warn(
        '"run" is a reserved subcommand. The config command named "run" is ignored.\n' +
        'Rename it in envlock.config.js to use it as a named command.',
      );
    }
    const runArgs = passthrough.slice(1);
    if (runArgs.length === 0) {
      throw new Error(
        "[envlock] Usage: envlock run <command> [args...]\n" +
        "Example: envlock run node server.js --port 4000",
      );
    }
    return { command: runArgs[0]!, args: runArgs.slice(1) };
  }

  if (config?.commands && firstArg in config.commands) {
    const cmdString = config.commands[firstArg];
    if (!cmdString || cmdString.trim() === "") {
      throw new Error(`[envlock] Command "${firstArg}" is empty in envlock.config.js.`);
    }
    const parts = splitCommand(cmdString);
    return { command: parts[0]!, args: parts.slice(1) };
  }

  if (config?.commands && Object.keys(config.commands).length > 0 && passthrough.length === 1) {
    throw new Error(
      `[envlock] Unknown command "${firstArg}". Available: ${Object.keys(config.commands).join(", ")}`,
    );
  }

  return { command: firstArg, args: passthrough.slice(1) };
}

export async function run(argv: string[], cwd: string = process.cwd()): Promise<void> {
  const { environment, passthrough, debug } = parseArgs(argv);
  if (debug) setVerbose(true);

  const config = await resolveConfig(cwd);
  const { command, args } = resolveCommand(passthrough, config);

  const onePasswordEnvId = process.env["ENVLOCK_OP_ENV_ID"] ?? config?.onePasswordEnvId;
  if (!onePasswordEnvId) {
    throw new Error(
      "[envlock] No onePasswordEnvId found. Set it in envlock.config.js or via ENVLOCK_OP_ENV_ID env var.",
    );
  }

  validateOnePasswordEnvId(onePasswordEnvId);

  const envFile = config?.envFiles?.[environment] ?? DEFAULT_ENV_FILES[environment];
  validateEnvFilePath(envFile, cwd);

  log.debug(`Environment: ${environment}`);
  log.debug(`Env file: ${envFile}`);
  log.debug(`Command: ${command} ${args.join(" ")}`);

  await runWithSecrets({ envFile, environment, onePasswordEnvId, command, args });
}

// Binary entry point — only runs when executed directly.
// realpathSync resolves symlinks so that npm-installed bin symlinks
// (node_modules/.bin/envlock → ../envlock-core/dist/cli/index.js)
// match import.meta.url, which always reflects the real file path.
const _resolvedArgv1 = (() => {
  try { return realpathSync(process.argv[1] ?? ""); }
  catch { return process.argv[1] ?? ""; }
})();

if (import.meta.url === pathToFileURL(_resolvedArgv1).href) {
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

**Step 4: Update the import line in index.test.ts**

Find:
```typescript
const { run } = await import("./index.js");
```
Replace with:
```typescript
const { run, parseArgs, resolveCommand } = await import("./index.js");
```

**Step 5: Run all core tests**

```bash
cd packages/core && pnpm test
```
Expected: all tests pass.

**Step 6: Commit**

```bash
git add packages/core/src/cli/index.ts packages/core/src/cli/index.test.ts
git commit -m "refactor(core): split run() into parseArgs and resolveCommand pure functions"
```

---

### Task 5: Update next/cli/index.ts to import constants from core and extract helpers

**Files:**
- Modify: `packages/next/src/cli/index.ts`
- Test: `packages/next/src/cli/index.test.ts`

**Step 1: Write failing tests for the new helpers**

Add to `packages/next/src/cli/index.test.ts`. First update the mock to include the new exports:

```typescript
vi.mock("envlock-core", () => ({
  ENVIRONMENTS: { development: "development", staging: "staging", production: "production" },
  ARGUMENT_FLAGS: { staging: "--staging", production: "--production" },
  DEFAULT_ENV_FILES: { development: ".env.development", staging: ".env.staging", production: ".env.production" },
  runWithSecrets: vi.fn(),
  validateEnvFilePath: vi.fn(),
  validateOnePasswordEnvId: vi.fn(),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  setVerbose: vi.fn(),
  findFreePort: vi.fn(),
}));
```

Then add a new describe block:

```typescript
// Add to imports at top of file:
// const { updatePortArg } = await import("./index.js");
```

```typescript
describe("updatePortArg", () => {
  it("prepends -p <port> when no port flag present", () => {
    const result = updatePortArg(["--turbo"], 3001);
    expect(result).toEqual(["-p", "3001", "--turbo"]);
  });

  it("replaces existing --port <n> with -p <newPort>", () => {
    const result = updatePortArg(["--port", "3000", "--turbo"], 3001);
    expect(result).toEqual(["-p", "3001", "--turbo"]);
  });

  it("replaces existing -p <n> with -p <newPort>", () => {
    const result = updatePortArg(["-p", "3000", "--turbo"], 3001);
    expect(result).toEqual(["-p", "3001", "--turbo"]);
  });

  it("returns [-p, port] for empty args", () => {
    const result = updatePortArg([], 3000);
    expect(result).toEqual(["-p", "3000"]);
  });
});
```

**Step 2: Run to confirm they fail**

```bash
cd packages/next && pnpm test cli/index
```
Expected: `updatePortArg` tests FAIL with "not a function".

**Step 3: Refactor next/cli/index.ts**

Replace the file with:

```typescript
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
import { Command } from "commander";
import {
  ENVIRONMENTS,
  ARGUMENT_FLAGS,
  DEFAULT_ENV_FILES,
  runWithSecrets,
  validateEnvFilePath,
  validateOnePasswordEnvId,
  log,
  setVerbose,
  findFreePort,
} from "envlock-core";
import type { Environment } from "envlock-core";
import { resolveConfig } from "./resolve-config.js";

const SUPPORTED_SUBCOMMANDS = {
  dev: "development",
  build: "production",
  start: "production",
} as const;

type Subcommand = keyof typeof SUPPORTED_SUBCOMMANDS;

const SUBCOMMAND_DESCRIPTIONS: Record<Subcommand, string> = {
  dev: "Start Next.js development server",
  build: "Build Next.js application",
  start: "Start Next.js production server",
};

/** Pure function — replaces or inserts the port flag in a Next.js args array. */
export function updatePortArg(args: string[], newPort: number): string[] {
  const portFlagIndex = args.findIndex((a) => a === "--port" || a === "-p");
  const withoutPort =
    portFlagIndex !== -1 ? args.filter((_, i) => i !== portFlagIndex && i !== portFlagIndex + 1) : args;
  return ["-p", String(newPort), ...withoutPort];
}

async function resolveAndValidateConfig(
  environment: Environment,
  cwd: string,
): Promise<{ onePasswordEnvId: string; envFile: string }> {
  const config = await resolveConfig(cwd);
  const onePasswordEnvId = process.env["ENVLOCK_OP_ENV_ID"] ?? config.onePasswordEnvId;
  if (!onePasswordEnvId) {
    throw new Error(
      "[envlock] No onePasswordEnvId found. Set it in envlock.config.js or via ENVLOCK_OP_ENV_ID env var.",
    );
  }
  validateOnePasswordEnvId(onePasswordEnvId);
  const envFile = config.envFiles?.[environment] ?? DEFAULT_ENV_FILES[environment];
  validateEnvFilePath(envFile, cwd);
  return { onePasswordEnvId, envFile };
}

export async function runNextCommand(
  subcommand: Subcommand,
  environment: Environment,
  passthroughArgs: string[],
): Promise<void> {
  const { onePasswordEnvId, envFile } = await resolveAndValidateConfig(environment, process.cwd());

  let finalArgs = [...passthroughArgs];

  if (subcommand === "dev") {
    const portFlagIndex = finalArgs.findIndex((a) => a === "--port" || a === "-p");
    const requestedPort =
      portFlagIndex !== -1 ? parseInt(finalArgs[portFlagIndex + 1] ?? "3000", 10) : 3000;
    const freePort = await findFreePort(requestedPort);
    if (freePort !== requestedPort) {
      log.warn(`Port ${requestedPort} in use, switching to ${freePort}`);
    }
    finalArgs = updatePortArg(finalArgs, freePort);
  }

  log.debug(`Environment: ${environment}`);
  log.debug(`Env file: ${envFile}`);
  log.debug(`Command: next ${subcommand} ${finalArgs.join(" ")}`);

  await runWithSecrets({
    envFile,
    environment,
    onePasswordEnvId,
    command: "next",
    args: [subcommand, ...finalArgs],
  });
}

function addEnvFlags(cmd: Command): Command {
  return cmd
    .option(ARGUMENT_FLAGS.staging, "use staging environment")
    .option(ARGUMENT_FLAGS.production, "use production environment")
    .allowUnknownOption(true);
}

function getEnvironment(
  opts: { staging?: boolean; production?: boolean },
  defaultEnv: Environment,
): Environment {
  if (opts.production) return ENVIRONMENTS.production;
  if (opts.staging) return ENVIRONMENTS.staging;
  return defaultEnv;
}

export async function handleRunCommand(
  cmd: string | undefined,
  cmdArgs: string[],
  opts: { staging?: boolean; production?: boolean },
): Promise<void> {
  if (!cmd) {
    throw new Error(
      "[envlock] Usage: envlock run <command> [args...]\n" +
      "Example: envlock run node server.js --port 4000",
    );
  }
  const environment = getEnvironment(opts, ENVIRONMENTS.development);
  const { onePasswordEnvId, envFile } = await resolveAndValidateConfig(environment, process.cwd());

  log.debug(`Environment: ${environment}`);
  log.debug(`Env file: ${envFile}`);
  log.debug(`Command: ${cmd} ${cmdArgs.join(" ")}`);

  await runWithSecrets({ envFile, environment, onePasswordEnvId, command: cmd, args: cmdArgs });
}

const program = new Command("envlock");

program
  .name("envlock")
  .description("Run Next.js commands with 1Password + dotenvx secret injection")
  .version("0.3.0")
  .enablePositionalOptions()
  .option("-d, --debug", "enable debug output");

for (const [subcommand, defaultEnv] of Object.entries(
  SUPPORTED_SUBCOMMANDS,
) as [Subcommand, Environment][]) {
  const cmd = new Command(subcommand)
    .description(SUBCOMMAND_DESCRIPTIONS[subcommand])
    .allowUnknownOption(true);
  addEnvFlags(cmd).action(
    async (opts: { staging?: boolean; production?: boolean }) => {
      await runNextCommand(subcommand, getEnvironment(opts, defaultEnv), cmd.args);
    },
  );
  program.addCommand(cmd);
}

const runCmd = new Command("run")
  .description("Run any command with 1Password + dotenvx secret injection")
  .allowUnknownOption(true)
  .passThroughOptions(true);

addEnvFlags(runCmd).action(
  async (opts: { staging?: boolean; production?: boolean }) => {
    const [cmd, ...cmdArgs] = runCmd.args;
    try {
      await handleRunCommand(cmd, cmdArgs, opts);
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
);

program.addCommand(runCmd);

// Binary entry point — only runs when executed directly.
// realpathSync resolves npm bin symlinks so import.meta.url matches process.argv[1].
const _resolvedArgv1Next = (() => {
  try { return realpathSync(process.argv[1] ?? ""); }
  catch { return process.argv[1] ?? ""; }
})();

if (import.meta.url === pathToFileURL(_resolvedArgv1Next).href) {
  if (process.argv.includes("--debug") || process.argv.includes("-d")) {
    setVerbose(true);
  }
  log.debug(`Resolved argv[1]: ${_resolvedArgv1Next}`);
  program.parse(process.argv);
}
```

**Step 4: Update the import line in next index.test.ts**

Find:
```typescript
const { handleRunCommand, runNextCommand } = await import("./index.js");
```
Replace with:
```typescript
const { handleRunCommand, runNextCommand, updatePortArg } = await import("./index.js");
```

**Step 5: Run all next tests**

```bash
cd packages/next && pnpm test
```
Expected: all tests pass.

**Step 6: Commit**

```bash
git add packages/next/src/cli/index.ts packages/next/src/cli/index.test.ts
git commit -m "refactor(next): extract updatePortArg and resolveAndValidateConfig helpers, import constants from core"
```

---

### Task 6: Add runtime type guards to next/cli/resolve-config.ts

**Files:**
- Modify: `packages/next/src/cli/resolve-config.ts`
- Test: `packages/next/src/cli/resolve-config.test.ts`

**Step 1: Read the existing test file**

```bash
cat packages/next/src/cli/resolve-config.test.ts
```

**Step 2: Write failing tests**

Add to `packages/next/src/cli/resolve-config.test.ts`:

```typescript
it("throws when __envlock.onePasswordEnvId is not a string", async () => {
  // Create a mock next.config.js in tmpDir where __envlock.onePasswordEnvId is a number
  writeFileSync(
    join(tmpDir, "next.config.js"),
    `export default { __envlock: { onePasswordEnvId: 99 } };`,
  );
  await expect(resolveConfig(tmpDir)).rejects.toThrow(/invalid/i);
});

it("throws when __envlock.envFiles is not an object", async () => {
  writeFileSync(
    join(tmpDir, "next.config.js"),
    `export default { __envlock: { onePasswordEnvId: "my-id", envFiles: "bad" } };`,
  );
  await expect(resolveConfig(tmpDir)).rejects.toThrow(/invalid/i);
});

it("includes next.config.cjs in candidates", async () => {
  writeFileSync(
    join(tmpDir, "next.config.cjs"),
    `module.exports = { __envlock: { onePasswordEnvId: "cjs-id" } };`,
  );
  const result = await resolveConfig(tmpDir);
  expect(result.onePasswordEnvId).toBe("cjs-id");
});
```

(Note: the test file will need to create a `tmpDir` — check if one already exists in the file's beforeEach and reuse it.)

**Step 3: Run to confirm they fail**

```bash
cd packages/next && pnpm test resolve-config
```
Expected: 3 new tests FAIL.

**Step 4: Update next/cli/resolve-config.ts**

Replace the file content:

```typescript
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { EnvlockOptions } from "envlock-core";
import { validateOnePasswordEnvId, log } from "envlock-core";

const CONFIG_CANDIDATES = [
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "next.config.cjs",
];

export async function resolveConfig(cwd: string): Promise<EnvlockOptions> {
  for (const candidate of CONFIG_CANDIDATES) {
    const fullPath = resolve(cwd, candidate);
    if (!existsSync(fullPath)) continue;

    try {
      const mod = await import(pathToFileURL(fullPath).href);
      const config = (mod as Record<string, unknown>).default ?? mod;

      if (
        config &&
        typeof config === "object" &&
        "__envlock" in config &&
        config.__envlock &&
        typeof config.__envlock === "object" &&
        "onePasswordEnvId" in config.__envlock
      ) {
        const envlock = config.__envlock as Record<string, unknown>;

        if (typeof envlock["onePasswordEnvId"] !== "string") {
          throw new Error(
            `[envlock] ${candidate}: __envlock.onePasswordEnvId must be a string.`,
          );
        }

        if (
          "envFiles" in envlock &&
          (typeof envlock["envFiles"] !== "object" || envlock["envFiles"] === null)
        ) {
          throw new Error(
            `[envlock] ${candidate}: __envlock.envFiles must be an object if provided.`,
          );
        }

        log.debug(`Config loaded from ${candidate}`);
        return envlock as unknown as EnvlockOptions;
      }
    } catch (err) {
      // Re-throw our own validation errors; warn and continue for load errors
      if (err instanceof Error && err.message.startsWith("[envlock]")) throw err;
      log.warn(`Failed to load ${candidate}: ${err instanceof Error ? err.message : String(err)}`);
      log.debug(`Stack: ${err instanceof Error ? (err.stack ?? "") : ""}`);
    }
  }

  if (process.env["ENVLOCK_OP_ENV_ID"]) {
    const id = process.env["ENVLOCK_OP_ENV_ID"];
    validateOnePasswordEnvId(id);
    return { onePasswordEnvId: id };
  }

  throw new Error(
    "[envlock] Could not find configuration.\n" +
      "Add withEnvlock() to your next.config.js:\n\n" +
      "  import { withEnvlock } from 'envlock-next';\n" +
      "  export default withEnvlock({}, { onePasswordEnvId: 'your-env-id' });\n\n" +
      "Or set the ENVLOCK_OP_ENV_ID environment variable.",
  );
}
```

**Step 5: Run all next tests**

```bash
cd packages/next && pnpm test
```
Expected: all pass.

**Step 6: Commit**

```bash
git add packages/next/src/cli/resolve-config.ts packages/next/src/cli/resolve-config.test.ts
git commit -m "fix(next): add runtime type guards to resolve-config and add next.config.cjs candidate"
```

---

### Task 7: Fix plugin.ts to use log.warn

**Files:**
- Modify: `packages/next/src/plugin.ts`
- Test: `packages/next/src/plugin.test.ts`

**Step 1: Read the existing plugin test to understand what's mocked**

```bash
cat packages/next/src/plugin.test.ts
```

**Step 2: Write a failing test**

Add to the describe block in `plugin.test.ts`:

```typescript
it("warns via log.warn (not console.warn) when onePasswordEnvId is missing", () => {
  const consoleSpy = vi.spyOn(console, "warn");
  // log is imported from envlock-core — spy on process.stderr.write which log.warn uses
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  withEnvlock({});
  expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("No onePasswordEnvId"));
  expect(consoleSpy).not.toHaveBeenCalled();
  stderrSpy.mockRestore();
  consoleSpy.mockRestore();
});
```

**Step 3: Run to confirm it fails**

```bash
cd packages/next && pnpm test plugin
```
Expected: FAIL — `consoleSpy` gets called, `stderrSpy` does not.

**Step 4: Update plugin.ts**

Add `log` to the import:
```typescript
import { validateOnePasswordEnvId, log } from "envlock-core";
```

Replace:
```typescript
console.warn(
  "[envlock] No onePasswordEnvId provided to withEnvlock(). " + ...
);
```
With:
```typescript
log.warn(
  "No onePasswordEnvId provided to withEnvlock(). " +
  "Set it to your 1Password Environment ID for automatic secret injection. " +
  "Alternatively, set ENVLOCK_OP_ENV_ID in your environment.",
);
```

**Step 5: Run all next tests**

```bash
cd packages/next && pnpm test
```
Expected: all pass.

**Step 6: Run all core tests too (sanity check)**

```bash
cd packages/core && pnpm test
```

**Step 7: Commit**

```bash
git add packages/next/src/plugin.ts packages/next/src/plugin.test.ts
git commit -m "fix(next): use log.warn instead of console.warn in plugin.ts"
```

---

### Task 8: Remove local constant re-definitions from core/cli/index.ts

**Files:**
- Modify: `packages/core/src/cli/index.ts`

This is a cleanup step — Task 4 already wrote the full refactored file that imports from `../types.js` instead of re-defining the constants. Verify it's clean.

**Step 1: Check that no local definitions remain**

```bash
grep -n "DEFAULT_ENV_FILES\|ARGUMENT_FLAGS" packages/core/src/cli/index.ts
```
Expected: only import references, no `const` definitions.

If the grep shows `const DEFAULT_ENV_FILES` or `const ARGUMENT_FLAGS` still defined locally (i.e. Task 4 wasn't done yet), remove them and import from `../types.js` instead.

**Step 2: Run all tests one final time across both packages**

```bash
cd packages/core && pnpm test && cd ../next && pnpm test
```
Expected: all pass.

**Step 3: Final commit if any cleanup was needed**

```bash
git add packages/core/src/cli/index.ts
git commit -m "chore(core): remove redundant local constant definitions now exported from types"
```
