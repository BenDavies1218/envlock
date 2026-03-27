import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { EnvlockConfig } from "../types.js";

const CONFIG_CANDIDATES = [
  "envlock.config.js",
  "envlock.config.mjs",
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
        return config as EnvlockConfig;
      }
    } catch (err) {
      console.warn(
        `[envlock] Failed to load ${candidate}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return null;
}
