export type Environment = "development" | "staging" | "production";

export interface EnvlockOptions {
  onePasswordEnvId: string;
  envFiles?: {
    development?: string;
    staging?: string;
    production?: string;
  };
}
