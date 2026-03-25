import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { EnvlockOptions } from "envlock-core";
import { validateOnePasswordEnvId } from "envlock-core";

const CONFIG_CANDIDATES = ["next.config.js", "next.config.mjs"];

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
        return config.__envlock as EnvlockOptions;
      }
    } catch (err) {
      console.warn(
        `[envlock] Failed to load ${candidate}: ${err instanceof Error ? err.message : String(err)}`,
      );
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
      "  import { withEnvlock } from 'envlock';\n" +
      "  export default withEnvlock({}, { onePasswordEnvId: 'your-env-id' });\n\n" +
      "Or set the ENVLOCK_OP_ENV_ID environment variable.",
  );
}
