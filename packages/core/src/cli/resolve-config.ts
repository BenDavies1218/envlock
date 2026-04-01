import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { EnvlockConfig } from "../types.js";
import { log } from "../logger.js";

const CONFIG_CANDIDATES = [
  "envlock.config.ts",
  "envlock.config.js",
  "envlock.config.mjs",
  "envlock.config.cjs",
];

export async function resolveConfig(cwd: string): Promise<EnvlockConfig | null> {
  for (const candidate of CONFIG_CANDIDATES) {
    const fullPath = resolve(cwd, candidate);
    if (!existsSync(fullPath)) continue;

    try {
      const mod = await import(pathToFileURL(fullPath).href);
      // Handle both ESM default exports and CJS module.exports = {}
      const config = (mod as Record<string, unknown>).default ?? mod;
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
    } catch (err) {
      log.warn(`Failed to load ${candidate}: ${err instanceof Error ? err.message : String(err)}`);
      log.debug(`Stack: ${err instanceof Error ? (err.stack ?? "") : ""}`);
    }
  }

  return null;
}
