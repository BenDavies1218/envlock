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

  // Enforce NEXT_PUBLIC_ prefix on all client keys
  if (options.client) {
    const invalidKeys = Object.keys(options.client).filter(
      (key) => !key.startsWith("NEXT_PUBLIC_"),
    );
    if (invalidKeys.length > 0) {
      throw new Error(
        `Client environment variables must be prefixed with NEXT_PUBLIC_. Invalid keys: ${invalidKeys.join(", ")}`,
      );
    }
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
