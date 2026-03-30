import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
import { Command } from "commander";
import { ENVIRONMENTS, runWithSecrets, validateEnvFilePath, validateOnePasswordEnvId } from "envlock-core";
import type { Environment } from "envlock-core";
import { log, setVerbose } from "envlock-core";
import { resolveConfig } from "./resolve-config.js";
import { findFreePort } from "./find-port.js";

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

export async function runNextCommand(
  subcommand: Subcommand,
  environment: Environment,
  passthroughArgs: string[],
): Promise<void> {
  const config = await resolveConfig(process.cwd());
  const envFile =
    config.envFiles?.[environment] ?? DEFAULT_ENV_FILES[environment];

  validateEnvFilePath(envFile, process.cwd());

  let finalArgs = [...passthroughArgs];

  // Port switching — dev only
  if (subcommand === "dev") {
    const portFlagIndex = finalArgs.findIndex(
      (a) => a === "--port" || a === "-p",
    );
    const requestedPort =
      portFlagIndex !== -1
        ? parseInt(finalArgs[portFlagIndex + 1] ?? "3000", 10)
        : 3000;

    const freePort = await findFreePort(requestedPort);

    if (freePort !== requestedPort) {
      log.warn(`Port ${requestedPort} in use, switching to ${freePort}`);
    }

    if (portFlagIndex !== -1) {
      finalArgs.splice(portFlagIndex, 2);
    }
    finalArgs = ["-p", String(freePort), ...finalArgs];
  }

  log.debug(`Environment: ${environment}`);
  log.debug(`Env file: ${envFile}`);
  log.debug(`Command: next ${subcommand} ${finalArgs.join(" ")}`);

  runWithSecrets({
    envFile,
    environment,
    onePasswordEnvId: config.onePasswordEnvId,
    command: "next",
    args: [subcommand, ...finalArgs],
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
  log.debug(`Environment: ${environment}`);
  log.debug(`Env file: ${envFile}`);
  log.debug(`Command: ${cmd} ${cmdArgs.join(" ")}`);
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
  .enablePositionalOptions()
  .option("-d, --debug", "enable debug output");

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
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
);

program.addCommand(runCmd);

// Binary entry point — only runs when executed directly.
// realpathSync resolves npm bin symlinks so import.meta.url matches process.argv[1].
const _resolvedArgv1Next = (() => {
  try { return realpathSync(process.argv[1] ?? ""); }
  catch { return process.argv[1] ?? ""; }
})();

if (import.meta.url === pathToFileURL(_resolvedArgv1Next).href) {
  // Enable debug before parse so log.debug works during subcommand dispatch
  if (process.argv.includes("--debug") || process.argv.includes("-d")) {
    setVerbose(true);
  }
  log.debug(`Resolved argv[1]: ${_resolvedArgv1Next}`);
  program.parse(process.argv);
}
