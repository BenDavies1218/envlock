import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { ENVIRONMENTS, runWithSecrets, validateEnvFilePath, validateOnePasswordEnvId } from "envlock-core";
import type { Environment } from "envlock-core";
import { resolveConfig } from "./resolve-config.js";

const SUPPORTED_SUBCOMMANDS = {
  dev: "development",
  build: "production",
  start: "production",
} as const;

type Subcommand = keyof typeof SUPPORTED_SUBCOMMANDS;

const SUBCOMMAND_DESCRIPTIONS: Record<Subcommand, string> = {
  dev: "Start Next.js development server",
  build: "Build Next.js application",
  start: "Start Next.js production server",
};

const DEFAULT_ENV_FILES: Record<Environment, string> = {
  development: ".env.development",
  staging: ".env.staging",
  production: ".env.production",
};

const ARGUMENT_FLAGS = {
  staging: "--staging",
  production: "--production",
} as const;

async function runNextCommand(
  subcommand: Subcommand,
  environment: Environment,
  passthroughArgs: string[],
): Promise<void> {
  const config = await resolveConfig(process.cwd());
  const envFile =
    config.envFiles?.[environment] ?? DEFAULT_ENV_FILES[environment];

  validateEnvFilePath(envFile, process.cwd());

  runWithSecrets({
    envFile,
    environment,
    onePasswordEnvId: config.onePasswordEnvId,
    command: "next",
    args: [subcommand, ...passthroughArgs],
  });
}

function addEnvFlags(cmd: Command): Command {
  return cmd
    .option(ARGUMENT_FLAGS.staging, "use staging environment")
    .option(ARGUMENT_FLAGS.production, "use production environment")
    .allowUnknownOption(true);
}

function getEnvironment(
  opts: { staging?: boolean; production?: boolean },
  defaultEnv: Environment,
): Environment {
  if (opts.production) return ENVIRONMENTS.production;
  if (opts.staging) return ENVIRONMENTS.staging;
  return defaultEnv;
}

export async function handleRunCommand(
  cmd: string | undefined,
  cmdArgs: string[],
  opts: { staging?: boolean; production?: boolean },
): Promise<void> {
  if (!cmd) {
    throw new Error(
      "[envlock] Usage: envlock run <command> [args...]\n" +
      "Example: envlock run node server.js --port 4000",
    );
  }
  const environment = getEnvironment(opts, ENVIRONMENTS.development);
  const config = await resolveConfig(process.cwd());
  const onePasswordEnvId = process.env["ENVLOCK_OP_ENV_ID"] ?? config.onePasswordEnvId;
  if (!onePasswordEnvId) {
    throw new Error(
      "[envlock] No onePasswordEnvId found. Set it in envlock.config.js or via ENVLOCK_OP_ENV_ID env var.",
    );
  }
  validateOnePasswordEnvId(onePasswordEnvId);
  const envFile = config.envFiles?.[environment] ?? DEFAULT_ENV_FILES[environment];
  validateEnvFilePath(envFile, process.cwd());
  runWithSecrets({
    envFile,
    environment,
    onePasswordEnvId,
    command: cmd,
    args: cmdArgs,
  });
}

const program = new Command("envlock");

program
  .name("envlock")
  .description("Run Next.js commands with 1Password + dotenvx secret injection")
  .version("0.3.0")
  .enablePositionalOptions();

for (const [subcommand, defaultEnv] of Object.entries(
  SUPPORTED_SUBCOMMANDS,
) as [Subcommand, Environment][]) {
  const cmd = new Command(subcommand)
    .description(SUBCOMMAND_DESCRIPTIONS[subcommand])
    .allowUnknownOption(true);
  addEnvFlags(cmd).action(
    async (opts: { staging?: boolean; production?: boolean }) => {
      await runNextCommand(subcommand, getEnvironment(opts, defaultEnv), cmd.args);
    },
  );
  program.addCommand(cmd);
}

const runCmd = new Command("run")
  .description("Run any command with 1Password + dotenvx secret injection")
  .allowUnknownOption(true)
  .passThroughOptions(true);

addEnvFlags(runCmd).action(
  async (opts: { staging?: boolean; production?: boolean }) => {
    const [cmd, ...cmdArgs] = runCmd.args;
    try {
      await handleRunCommand(cmd, cmdArgs, opts);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
);

program.addCommand(runCmd);

// Binary entry point — only runs when executed directly
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  program.parse(process.argv);
}
