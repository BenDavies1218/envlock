import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
import { ENVIRONMENTS, ARGUMENT_FLAGS, DEFAULT_ENV_FILES } from "../types.js";
import type { Environment, EnvlockConfig } from "../types.js";
import { runWithSecrets } from "../invoke.js";
import { validateEnvFilePath, validateOnePasswordEnvId } from "../validate.js";
import { resolveConfig } from "./resolve-config.js";
import { log, setVerbose } from "../logger.js";

/**
 * Splits a command string into tokens, respecting single and double quoted groups.
 *
 * Limitation: escaped quotes inside quoted strings (e.g. "it\"s") are NOT supported.
 * Inputs with escaped quotes will produce incorrect tokens. Use shell-quote if you
 * need full POSIX shell parsing.
 */
function splitCommand(cmd: string): string[] {
  const parts: string[] = [];
  const re = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cmd)) !== null) {
    parts.push(match[1] ?? match[2] ?? match[0]!);
  }
  return parts;
}

export interface ParsedArgs {
  environment: Environment;
  passthrough: string[];
  debug: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const debugIdx = argv.findIndex((a) => a === "--debug" || a === "-d");
  const debug = debugIdx !== -1;
  const withoutDebug = debug ? argv.filter((_, i) => i !== debugIdx) : argv;

  const environment: Environment = withoutDebug.includes(ARGUMENT_FLAGS.production)
    ? ENVIRONMENTS.production
    : withoutDebug.includes(ARGUMENT_FLAGS.staging)
    ? ENVIRONMENTS.staging
    : ENVIRONMENTS.development;

  const passthrough = withoutDebug.filter(
    (f) => f !== ARGUMENT_FLAGS.staging && f !== ARGUMENT_FLAGS.production,
  );

  return { environment, passthrough, debug };
}

export function resolveCommand(
  passthrough: string[],
  config: EnvlockConfig | null,
): { command: string; args: string[] } {
  const firstArg = passthrough[0];

  if (firstArg === undefined) {
    const available = config?.commands ? Object.keys(config.commands).join(", ") : "none";
    throw new Error(`[envlock] No command specified. Available commands: ${available}`);
  }

  if (firstArg === "run") {
    if (config?.commands?.["run"]) {
      log.warn(
        '"run" is a reserved subcommand. The config command named "run" is ignored.\n' +
        'Rename it in envlock.config.ts to use it as a named command.',
      );
    }
    const runArgs = passthrough.slice(1);
    if (runArgs.length === 0) {
      throw new Error(
        "[envlock] Usage: envlock run <command> [args...]\n" +
        "Example: envlock run node server.js --port 4000",
      );
    }
    return { command: runArgs[0]!, args: runArgs.slice(1) };
  }

  if (config?.commands && firstArg in config.commands) {
    const cmdString = config.commands[firstArg];
    if (!cmdString || cmdString.trim() === "") {
      throw new Error(`[envlock] Command "${firstArg}" is empty in envlock.config.ts.`);
    }
    const parts = splitCommand(cmdString);
    return { command: parts[0]!, args: parts.slice(1) };
  }

  if (config?.commands && Object.keys(config.commands).length > 0 && passthrough.length === 1) {
    throw new Error(
      `[envlock] Unknown command "${firstArg}". Available: ${Object.keys(config.commands).join(", ")}`,
    );
  }

  return { command: firstArg, args: passthrough.slice(1) };
}

export async function run(argv: string[], cwd: string = process.cwd()): Promise<void> {
  const { environment, passthrough, debug } = parseArgs(argv);
  if (debug) setVerbose(true);

  const config = await resolveConfig(cwd);
  const { command, args } = resolveCommand(passthrough, config);

  const onePasswordEnvId = process.env["ENVLOCK_OP_ENV_ID"] ?? config?.onePasswordEnvId;
  if (!onePasswordEnvId) {
    throw new Error(
      "[envlock] No onePasswordEnvId found. Set it in envlock.config.ts or via ENVLOCK_OP_ENV_ID env var.",
    );
  }

  validateOnePasswordEnvId(onePasswordEnvId);

  const envFile = config?.envFiles?.[environment] ?? DEFAULT_ENV_FILES[environment];
  validateEnvFilePath(envFile, cwd);

  log.debug(`Environment: ${environment}`);
  log.debug(`Env file: ${envFile}`);
  log.debug(`Command: ${command} ${args.join(" ")}`);

  await runWithSecrets({ envFile, environment, onePasswordEnvId, command, args });
}

// Binary entry point — only runs when executed directly.
// realpathSync resolves symlinks so that npm-installed bin symlinks
// (node_modules/.bin/envlock → ../envlock-core/dist/cli/index.js)
// match import.meta.url, which always reflects the real file path.
const _resolvedArgv1 = (() => {
  try { return realpathSync(process.argv[1] ?? ""); }
  catch { return process.argv[1] ?? ""; }
})();

if (import.meta.url === pathToFileURL(_resolvedArgv1).href) {
  if (process.argv.includes("--debug") || process.argv.includes("-d")) {
    setVerbose(true);
  }
  log.debug(`Resolved argv[1]: ${_resolvedArgv1}`);
  run(process.argv.slice(2)).catch((err: unknown) => {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
