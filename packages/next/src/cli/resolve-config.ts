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
