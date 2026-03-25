import { isAbsolute, relative, resolve } from "node:path";

const OP_ENV_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function validateOnePasswordEnvId(id: string): void {
  if (!id || !OP_ENV_ID_PATTERN.test(id)) {
    throw new Error(
      `[envlock] Invalid onePasswordEnvId: "${id}". ` +
        "Must be a lowercase alphanumeric string (hyphens allowed), e.g. 'ca6uypwvab5mevel44gqdc2zae'.",
    );
  }
}

export function validateEnvFilePath(envFile: string, cwd: string): void {
  if (envFile.includes("\x00")) {
    throw new Error(`[envlock] Invalid env file path: null bytes are not allowed.`);
  }

  const resolved = resolve(cwd, envFile);
  const base = resolve(cwd);
  const rel = relative(base, resolved);

  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(
      `[envlock] Invalid env file path: "${envFile}" resolves outside the project directory.`,
    );
  }
}
