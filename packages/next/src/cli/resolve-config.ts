import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { EnvlockOptions } from "envlock-core";
import { validateOnePasswordEnvId, log } from "envlock-core";

/** Dedicated config files — read top-level onePasswordEnvId directly. */
const ENVLOCK_CONFIG_CANDIDATES = [
  "envlock.config.ts",
  "envlock.config.js",
  "envlock.config.mjs",
  "envlock.config.cjs",
];

/** Next.js config files — read from legacy __envlock key for backward compatibility. */
const NEXT_CONFIG_CANDIDATES = [
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "next.config.cjs",
];

async function tryLoadEnvlockConfig(
  cwd: string,
  candidate: string,
): Promise<EnvlockOptions | null> {
  const fullPath = resolve(cwd, candidate);
  if (!existsSync(fullPath)) return null;

  try {
    const mod = await import(pathToFileURL(fullPath).href);
    const config = (mod as Record<string, unknown>).default ?? mod;

    if (!config || typeof config !== "object") return null;

    const c = config as Record<string, unknown>;

    if (!("onePasswordEnvId" in c)) return null;

    if (typeof c["onePasswordEnvId"] !== "string") {
      throw new Error(
        `[envlock] ${candidate}: invalid config — onePasswordEnvId must be a string.`,
      );
    }

    if (
      "envFiles" in c &&
      (typeof c["envFiles"] !== "object" || c["envFiles"] === null)
    ) {
      throw new Error(
        `[envlock] ${candidate}: invalid config — envFiles must be an object if provided.`,
      );
    }

    log.debug(`Config loaded from ${candidate}`);
    return config as EnvlockOptions;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("[envlock]")) throw err;
    log.warn(`Failed to load ${candidate}: ${err instanceof Error ? err.message : String(err)}`);
    log.debug(`Stack: ${err instanceof Error ? (err.stack ?? "") : ""}`);
    return null;
  }
}

async function tryLoadNextConfig(
  cwd: string,
  candidate: string,
): Promise<EnvlockOptions | null> {
  const fullPath = resolve(cwd, candidate);
  if (!existsSync(fullPath)) return null;

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
          `[envlock] ${candidate}: invalid config — __envlock.onePasswordEnvId must be a string.`,
        );
      }

      if (
        "envFiles" in envlock &&
        (typeof envlock["envFiles"] !== "object" || envlock["envFiles"] === null)
      ) {
        throw new Error(
          `[envlock] ${candidate}: invalid config — __envlock.envFiles must be an object if provided.`,
        );
      }

      log.debug(`Config loaded from ${candidate} (__envlock)`);
      return envlock as unknown as EnvlockOptions;
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("[envlock]")) throw err;
    log.warn(`Failed to load ${candidate}: ${err instanceof Error ? err.message : String(err)}`);
    log.debug(`Stack: ${err instanceof Error ? (err.stack ?? "") : ""}`);
  }

  return null;
}

export async function resolveConfig(cwd: string): Promise<EnvlockOptions> {
  for (const candidate of ENVLOCK_CONFIG_CANDIDATES) {
    const result = await tryLoadEnvlockConfig(cwd, candidate);
    if (result) return result;
  }

  for (const candidate of NEXT_CONFIG_CANDIDATES) {
    const result = await tryLoadNextConfig(cwd, candidate);
    if (result) return result;
  }

  if (process.env["ENVLOCK_OP_ENV_ID"]) {
    const id = process.env["ENVLOCK_OP_ENV_ID"];
    validateOnePasswordEnvId(id);
    return { onePasswordEnvId: id };
  }

  throw new Error(
    "[envlock] Could not find configuration.\n" +
      "Create an envlock.config.js file:\n\n" +
      "  export default { onePasswordEnvId: 'your-env-id' };\n\n" +
      "Or set the ENVLOCK_OP_ENV_ID environment variable.",
  );
}
