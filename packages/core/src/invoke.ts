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

export async function runWithSecrets(options: RunWithSecretsOptions): Promise<void> {
  const { envFile, environment, onePasswordEnvId, command, args } = options;

  const privateKeyVar = `DOTENV_PRIVATE_KEY_${environment.toUpperCase()}`;
  const keyAlreadyInjected = !!process.env[privateKeyVar];

  if (!keyAlreadyInjected) {
    // Re-invoke this process inside `op run` so the private key lands in process.env.
    // op run exec's into the child, so spawnSync blocks until the inner process exits.
    checkBinary(
      "op",
      "Install 1Password CLI: brew install --cask 1password-cli@beta\nThen sign in: op signin",
    );
    log.debug(`Re-invoking via: op run --environment ${onePasswordEnvId}`);
    const result = spawnSync(
      "op",
      [
        "run",
        "--environment",
        onePasswordEnvId,
        "--",
        process.execPath,
        ...process.execArgv,
        process.argv[1]!,
        ...process.argv.slice(2),
      ],
      { stdio: "inherit" },
    );
    if (result.error) {
      throw new Error(`[envlock] Failed to spawn 'op': ${result.error.message}`);
    }
    process.exit(result.status ?? 1);
    return;
  }

  // Private key is in process.env — use dotenvx JS API to decrypt the env file.
  log.debug(`Decrypting ${envFile} via dotenvx`);
  const { config } = await import("@dotenvx/dotenvx");
  config({ path: envFile });

  // Run the command as a direct child — spawnSync blocks correctly.
  log.debug(`Spawning: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    throw new Error(`[envlock] Failed to spawn '${command}': ${result.error.message}`);
  }
  process.exit(result.status ?? 1);
}
