export const ENVIRONMENTS = {
  development: "development",
  staging: "staging",
  production: "production",
} as const;

export type Environment = keyof typeof ENVIRONMENTS;

export interface EnvlockOptions {
  onePasswordEnvId: string;
  envFiles?: Partial<Record<Environment, string>>;
}

export interface EnvlockConfig {
  /**
   * Your 1Password Environment ID.
   * Can alternatively be set via the ENVLOCK_OP_ENV_ID environment variable.
   */
  onePasswordEnvId?: string;
  envFiles?: Partial<Record<Environment, string>>;
  commands?: Record<string, string>;
}

export const ARGUMENT_FLAGS = {
  staging: "--staging",
  production: "--production",
} as const;

export const DEFAULT_ENV_FILES: Record<Environment, string> = {
  development: ".env.development",
  staging: ".env.staging",
  production: ".env.production",
};
