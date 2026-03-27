import { pathToFileURL } from "node:url";
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

function splitCommand(cmd: string): string[] {
  const parts: string[] = [];
  const re = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cmd)) !== null) {
    parts.push(match[1] ?? match[2] ?? match[0]!);
  }
  return parts;
}

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

  if (firstArg === undefined) {
    const available = config?.commands ? Object.keys(config.commands).join(", ") : "none";
    throw new Error(`[envlock] No command specified. Available commands: ${available}`);
  }

  if (config?.commands && firstArg in config.commands) {
    // Named command from config — split into binary + args
    const cmdString = config.commands[firstArg];
    if (!cmdString || cmdString.trim() === "") {
      throw new Error(`[envlock] Command "${firstArg}" is empty in envlock.config.js.`);
    }
    const parts = splitCommand(cmdString);
    command = parts[0]!;
    args = parts.slice(1);
  } else if (config?.commands && Object.keys(config.commands).length > 0 && passthrough.length === 1) {
    // Looks like a named command attempt but no match
    throw new Error(
      `[envlock] Unknown command "${firstArg}". Available: ${Object.keys(config.commands).join(", ")}`,
    );
  } else {
    // Ad-hoc command
    command = firstArg;
    args = passthrough.slice(1);
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
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run(process.argv.slice(2)).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
