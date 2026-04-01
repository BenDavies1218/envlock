import type { NextConfig } from "next";
import type { EnvlockOptions } from "envlock-core";
import { validateOnePasswordEnvId } from "envlock-core";

export function withEnvlock(
  nextConfig: NextConfig,
  options?: EnvlockOptions,
): NextConfig {
  if (options?.onePasswordEnvId) {
    validateOnePasswordEnvId(options.onePasswordEnvId);
  }
  return options ? { ...nextConfig, __envlock: options } : { ...nextConfig };
}
