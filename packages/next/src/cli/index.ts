import { Command } from "commander";
import { runWithSecrets, validateEnvFilePath } from "@envlock/core";
import { resolveConfig } from "./resolve-config.js";

type Environment = "development" | "staging" | "production";

const DEFAULT_ENV_FILES: Record<Environment, string> = {
  development: ".env.development",
  staging: ".env.staging",
  production: ".env.production",
};

async function runNextCommand(
  subcommand: string,
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
    .option("--staging", "use staging environment")
    .option("--production", "use production environment")
    .allowUnknownOption(true);
}

function getEnvironment(opts: {
  staging?: boolean;
  production?: boolean;
}): Environment {
  if (opts.production) return "production";
  if (opts.staging) return "staging";
  return "development";
}

const program = new Command("envlock");

program
  .name("envlock")
  .description("Run Next.js commands with 1Password + dotenvx secret injection")
  .version("0.1.0");

const devCmd = new Command("dev")
  .description("Start Next.js development server")
  .allowUnknownOption(true);
addEnvFlags(devCmd).action(async (opts: { staging?: boolean; production?: boolean }) => {
  const passthrough = devCmd.args.filter(
    (a) => a !== "--staging" && a !== "--production",
  );
  await runNextCommand("dev", getEnvironment(opts), passthrough);
});

const buildCmd = new Command("build")
  .description("Build Next.js application")
  .allowUnknownOption(true);
addEnvFlags(buildCmd).action(async (opts: { staging?: boolean; production?: boolean }) => {
  const passthrough = buildCmd.args.filter(
    (a) => a !== "--staging" && a !== "--production",
  );
  await runNextCommand("build", getEnvironment(opts), passthrough);
});

const startCmd = new Command("start")
  .description("Start Next.js production server")
  .allowUnknownOption(true);
addEnvFlags(startCmd).action(async (opts: { staging?: boolean; production?: boolean }) => {
  const passthrough = startCmd.args.filter(
    (a) => a !== "--staging" && a !== "--production",
  );
  await runNextCommand("start", getEnvironment(opts), passthrough);
});

program.addCommand(devCmd);
program.addCommand(buildCmd);
program.addCommand(startCmd);

program.parse(process.argv);
