import { spawnSync } from "node:child_process";
import { checkBinary } from "./detect.js";
import { log } from "./logger.js";
import type { Environment } from "./types.js";

export interface RunWithSecretsOptions {
  envFile: string;
  environment: Environment;
  onePasswordEnvId: string;
  command: string;
  args: string[];
}

export function runWithSecrets(options: RunWithSecretsOptions): void {
  const { envFile, environment, onePasswordEnvId, command, args } = options;

  checkBinary(
    "dotenvx",
    "Install dotenvx: npm install -g @dotenvx/dotenvx\nOr add it as a dev dependency.",
  );

  const privateKeyVar = `DOTENV_PRIVATE_KEY_${environment.toUpperCase()}`;
  const keyAlreadyInjected = !!process.env[privateKeyVar];

  let result;

  if (keyAlreadyInjected) {
    log.debug(`Spawning: dotenvx run -f ${envFile} -- ${command} ${args.join(" ")}`);
    result = spawnSync(
      "dotenvx",
      ["run", "-f", envFile, "--", command, ...args],
      { stdio: "inherit" },
    );
    if (result.error) {
      throw new Error(`[envlock] Failed to spawn 'dotenvx': ${result.error.message}`);
    }
  } else {
    checkBinary(
      "op",
      "Install 1Password CLI: brew install --cask 1password-cli@beta\nThen sign in: op signin",
    );
    log.debug(`Spawning: op run --environment ${onePasswordEnvId} -- dotenvx run -f ${envFile} -- ${command} ${args.join(" ")}`);
    result = spawnSync(
      "op",
      [
        "run",
        "--environment",
        onePasswordEnvId,
        "--",
        "dotenvx",
        "run",
        "-f",
        envFile,
        "--",
        command,
        ...args,
      ],
      { stdio: "inherit" },
    );
    if (result.error) {
      throw new Error(`[envlock] Failed to spawn 'op': ${result.error.message}`);
    }
  }

  process.exit(result.status ?? 1);
}
