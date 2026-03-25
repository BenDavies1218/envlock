import { spawnSync } from "node:child_process";
import { checkBinary } from "./detect.js";

export interface RunWithSecretsOptions {
  envFile: string;
  environment: string;
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
    result = spawnSync(
      "dotenvx",
      ["run", "-f", envFile, "--", command, ...args],
      { stdio: "inherit" },
    );
  } else {
    checkBinary(
      "op",
      "Install 1Password CLI: brew install --cask 1password-cli@beta\nThen sign in: op signin",
    );
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
  }

  process.exit(result.status ?? 1);
}
