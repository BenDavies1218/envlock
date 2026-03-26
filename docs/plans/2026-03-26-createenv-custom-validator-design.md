# Design: `createEnv` Custom Validator

**Date:** 2026-03-26
**Status:** Approved

## Summary

Replace the existing `createEnv` wrapper (which delegated to `@t3-oss/env-nextjs`) with a thin custom validator. Drop the t3 peer dependency entirely. When a schema is provided, validate `runtimeEnv` against it and throw a single error listing all failures. When no schema is provided, return `{}` immediately without validation.

## API

```ts
// With schema — validates and returns typed env
const env = createEnv({
  server: { DATABASE_URL: z.string().url() },
  client: { NEXT_PUBLIC_API_URL: z.string().url() },
  runtimeEnv: process.env, // optional, defaults to process.env
});

// No schema — returns {} immediately, no validation
const env = createEnv();
```

- `server` — optional record of `ZodType` values for server-side env vars
- `client` — optional record of `ZodType` values for client-side env vars
- `runtimeEnv` — optional env source, defaults to `process.env`
- Return type is inferred from the combined `server` + `client` schemas

## Behaviour

### Bypass paths (returns `{}` immediately)
- No schema provided (`createEnv()`)
- `SKIP_ENV_VALIDATION=1` is set

### Pre-processing
- Empty strings in `runtimeEnv` are coerced to `undefined` before validation (`emptyStringAsUndefined: true`)

### Validation
- Each key in `server` and `client` is parsed with `schema.safeParse(runtimeEnv[key])`
- All failures are collected before throwing
- A single `Error` is thrown listing every failing key and its message:

```
Invalid environment variables:
  DATABASE_URL: Invalid url
  NEXT_PUBLIC_API_URL: Required
```

### Success
- Returns the fully-typed parsed object merging `server` and `client` results

## Testing

Tests in `packages/next/src/env/index.test.ts` — drop the t3 mock, test real implementation:

| Scenario | Expected |
|---|---|
| No schema | Returns `{}` |
| `SKIP_ENV_VALIDATION=1` | Returns `{}` |
| Empty string value | Coerced to `undefined`, fails `z.string()` |
| All valid | Returns typed parsed object |
| One invalid field | Throws with that field listed |
| Multiple invalid fields | Throws with all fields listed |
| `server` + `client` both provided | Merged into single return object |

## Dependencies

- Remove `@t3-oss/env-nextjs` from peer dependencies and dev dependencies in `packages/next/package.json`
- `zod` remains a peer dependency (already present)
