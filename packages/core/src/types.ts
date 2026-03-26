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
