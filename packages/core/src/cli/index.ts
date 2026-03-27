import { ENVIRONMENTS } from "../types.js";
import type { Environment } from "../types.js";
import { runWithSecrets } from "../invoke.js";
import { validateEnvFilePath, validateOnePasswordEnvId } from "../validate.js";
import { resolveConfig } from "./resolve-config.js";

const ARGUMENT_FLAGS = {
  staging: "--staging",
  production: "--production",
} as const;

const DEFAULT_ENV_FILES: Record<Environment, string> = {
  development: ".env.development",
  staging: ".env.staging",
  production: ".env.production",
};

export async function run(argv: string[], cwd: string = process.cwd()): Promise<void> {
  const environment: Environment = argv.includes(ARGUMENT_FLAGS.production)
    ? ENVIRONMENTS.production
    : argv.includes(ARGUMENT_FLAGS.staging)
    ? ENVIRONMENTS.staging
    : ENVIRONMENTS.development;

  const passthrough = argv.filter(
    (f) => f !== ARGUMENT_FLAGS.staging && f !== ARGUMENT_FLAGS.production,
  );

  const config = await resolveConfig(cwd);
  const firstArg = passthrough[0];

  let command: string;
  let args: string[];

  if (firstArg !== undefined && config?.commands && firstArg in config.commands) {
    // Named command from config
    const parts = (config.commands[firstArg] as string).split(" ");
    command = parts[0] as string;
    args = parts.slice(1);
  } else if (firstArg !== undefined && (config === null || config.commands === undefined || !(firstArg in (config.commands ?? {})))) {
    // Check if it looks like a known command name with no match
    if (config?.commands && Object.keys(config.commands).length > 0 && passthrough.length === 1) {
      throw new Error(
        `[envlock] Unknown command "${firstArg}". Available: ${Object.keys(config.commands).join(", ")}`,
      );
    }
    // Ad-hoc command
    command = firstArg;
    args = passthrough.slice(1);
  } else {
    const available = config?.commands ? Object.keys(config.commands).join(", ") : "none";
    throw new Error(`[envlock] No command specified. Available commands: ${available}`);
  }

  const onePasswordEnvId = process.env["ENVLOCK_OP_ENV_ID"] ?? config?.onePasswordEnvId;

  if (!onePasswordEnvId) {
    throw new Error(
      "[envlock] No onePasswordEnvId found. Set it in envlock.config.js or via ENVLOCK_OP_ENV_ID env var.",
    );
  }

  validateOnePasswordEnvId(onePasswordEnvId);

  const envFile = config?.envFiles?.[environment] ?? DEFAULT_ENV_FILES[environment];
  validateEnvFilePath(envFile, cwd);

  runWithSecrets({ envFile, environment, onePasswordEnvId, command, args });
}

// Binary entry point — only runs when executed directly
if (process.argv[1]?.endsWith("cli/index.js")) {
  run(process.argv.slice(2)).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
