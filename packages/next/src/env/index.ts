import { z } from "zod";

type EnvSchema = Record<string, z.ZodType>;

type InferSchema<T extends EnvSchema> = { [K in keyof T]: z.infer<T[K]> };

export function createEnv<
  S extends EnvSchema = Record<string, never>,
  C extends EnvSchema = Record<string, never>,
>(
  options?: { server?: S; client?: C; runtimeEnv?: Record<string, string | undefined> },
): InferSchema<S> & InferSchema<C> {
  if (!options || (!options.server && !options.client)) {
    return {} as InferSchema<S> & InferSchema<C>;
  }

  const source = options.runtimeEnv ?? process.env;

  if (source["SKIP_ENV_VALIDATION"]) {
    return {} as InferSchema<S> & InferSchema<C>;
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
      const messages = result.error.errors
        .map((e) => (e.path.length > 0 ? `${e.path.join(".")}: ${e.message}` : e.message))
        .join("; ");
      errors.push(`  ${key}: ${messages}`);
    } else {
      parsed[key] = result.data;
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment variables:\n${errors.join("\n")}`);
  }

  return parsed as InferSchema<S> & InferSchema<C>;
}
