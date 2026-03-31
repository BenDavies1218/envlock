import type { NextConfig } from "next";
import type { EnvlockOptions } from "envlock-core";
import { validateOnePasswordEnvId, log } from "envlock-core";

export type EnvlockNextConfig = NextConfig & { __envlock: EnvlockOptions };

export function withEnvlock(
  nextConfig: NextConfig,
  options?: EnvlockOptions,
): EnvlockNextConfig {
  if (!options?.onePasswordEnvId) {
    log.warn(
      "No onePasswordEnvId provided to withEnvlock(). " +
      "Set it to your 1Password Environment ID for automatic secret injection. " +
      "Alternatively, set ENVLOCK_OP_ENV_ID in your environment.",
    );
  } else {
    validateOnePasswordEnvId(options.onePasswordEnvId);
  }

  return {
    ...nextConfig,
    __envlock: options ?? { onePasswordEnvId: "" },
  };
}
