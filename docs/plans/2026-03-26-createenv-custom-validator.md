# createEnv Custom Validator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the `@t3-oss/env-nextjs` wrapper in `createEnv` with a thin custom validator that parses Zod schemas against `runtimeEnv`, collects all failures, and throws a single formatted error — with a no-schema bypass that returns `{}`.

**Architecture:** `createEnv` accepts an optional `{ server, client, runtimeEnv }` where `server` and `client` are records of Zod schemas. It coerces empty strings to `undefined`, runs `safeParse` on every key, collects failures, and throws if any exist. `SKIP_ENV_VALIDATION=1` or omitting schemas entirely both short-circuit to `{}`.

**Tech Stack:** TypeScript, Zod, Vitest. No t3 dependency.

---

### Task 1: Replace the test file

**Files:**
- Modify: `packages/next/src/env/index.test.ts`

Drop all t3 mocks and write the full test suite against the real implementation.

**Step 1: Replace the entire test file contents**

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

const { createEnv } = await import("./index.js");

describe("createEnv", () => {
  it("returns {} when called with no arguments", () => {
    const env = createEnv();
    expect(env).toEqual({});
  });

  it("returns {} when SKIP_ENV_VALIDATION is set", () => {
    process.env["SKIP_ENV_VALIDATION"] = "1";
    const env = createEnv({
      server: { DB: z.string() },
      runtimeEnv: { DB: "postgres://localhost/db" },
    });
    expect(env).toEqual({});
    delete process.env["SKIP_ENV_VALIDATION"];
  });

  it("coerces empty strings to undefined before validation", () => {
    expect(() =>
      createEnv({
        server: { DB: z.string() },
        runtimeEnv: { DB: "" },
      }),
    ).toThrow("DB");
  });

  it("returns typed parsed object when all fields are valid", () => {
    const env = createEnv({
      server: { PORT: z.coerce.number() },
      client: { NEXT_PUBLIC_URL: z.string().url() },
      runtimeEnv: { PORT: "3000", NEXT_PUBLIC_URL: "https://example.com" },
    });
    expect(env).toEqual({ PORT: 3000, NEXT_PUBLIC_URL: "https://example.com" });
  });

  it("throws listing a single invalid field", () => {
    expect(() =>
      createEnv({
        server: { DATABASE_URL: z.string().url() },
        runtimeEnv: { DATABASE_URL: "not-a-url" },
      }),
    ).toThrow("DATABASE_URL");
  });

  it("throws listing all invalid fields", () => {
    let err: Error | undefined;
    try {
      createEnv({
        server: { DATABASE_URL: z.string().url(), SECRET: z.string().min(1) },
        runtimeEnv: { DATABASE_URL: "not-a-url", SECRET: "" },
      });
    } catch (e) {
      err = e as Error;
    }
    expect(err?.message).toMatch("DATABASE_URL");
    expect(err?.message).toMatch("SECRET");
  });

  it("merges server and client into a single return object", () => {
    const env = createEnv({
      server: { A: z.string() },
      client: { B: z.string() },
      runtimeEnv: { A: "hello", B: "world" },
    });
    expect(env).toEqual({ A: "hello", B: "world" });
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd packages/next && pnpm test
```

Expected: multiple failures — `createEnv` still delegates to t3 and doesn't behave as tested.

**Step 3: Commit the failing tests**

```bash
git add packages/next/src/env/index.test.ts
git commit -m "test(env): rewrite createEnv tests for custom validator"
```

---

### Task 2: Rewrite `createEnv`

**Files:**
- Modify: `packages/next/src/env/index.ts`

**Step 1: Replace the entire file contents**

```ts
import { z } from "zod";

type EnvSchema = Record<string, z.ZodType>;

interface CreateEnvArgs {
  server?: EnvSchema;
  client?: EnvSchema;
  runtimeEnv?: Record<string, string | undefined>;
}

export function createEnv(options?: CreateEnvArgs): Record<string, unknown> {
  if (!options || (!options.server && !options.client)) {
    return {};
  }

  if (process.env["SKIP_ENV_VALIDATION"]) {
    return {};
  }

  const source = options.runtimeEnv ?? process.env;
  const allSchemas = { ...options.server, ...options.client };

  // coerce empty strings to undefined
  const coerced: Record<string, unknown> = {};
  for (const key of Object.keys(allSchemas)) {
    const raw = source[key];
    coerced[key] = raw === "" ? undefined : raw;
  }

  const errors: string[] = [];
  const parsed: Record<string, unknown> = {};

  for (const [key, schema] of Object.entries(allSchemas)) {
    const result = schema.safeParse(coerced[key]);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message).join(", ");
      errors.push(`  ${key}: ${messages}`);
    } else {
      parsed[key] = result.data;
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment variables:\n${errors.join("\n")}`);
  }

  return parsed;
}
```

**Step 2: Run tests**

```bash
cd packages/next && pnpm test
```

Expected: all tests pass.

**Step 3: Commit**

```bash
git add packages/next/src/env/index.ts
git commit -m "feat(env): replace t3 wrapper with custom Zod validator"
```

---

### Task 3: Remove t3 from package.json

**Files:**
- Modify: `packages/next/package.json`

**Step 1: Remove `@t3-oss/env-nextjs` from `peerDependencies`, `peerDependenciesMeta`, and `devDependencies`**

In `packages/next/package.json`, delete these entries:

- From `peerDependencies`: `"@t3-oss/env-nextjs": ">=0.12.0"`
- From `peerDependenciesMeta`: the entire `"@t3-oss/env-nextjs"` block
- From `devDependencies`: `"@t3-oss/env-nextjs": "^0.12.0"`

**Step 2: Remove the import from `env/index.ts` (already done in Task 2 — verify)**

```bash
grep -r "@t3-oss" packages/next/src
```

Expected: no output.

**Step 3: Run install to sync lockfile**

```bash
pnpm install
```

**Step 4: Run tests to confirm nothing broken**

```bash
cd packages/next && pnpm test
```

Expected: all pass.

**Step 5: Commit**

```bash
git add packages/next/package.json pnpm-lock.yaml
git commit -m "chore(deps): remove @t3-oss/env-nextjs dependency"
```

---

### Task 4: Verify build

**Step 1: Build the package**

```bash
cd packages/next && pnpm build
```

Expected: `dist/` emitted with no errors.

**Step 2: Commit if any generated files changed**

```bash
git add packages/next/dist
git commit -m "build: rebuild after t3 removal" --allow-empty
```
