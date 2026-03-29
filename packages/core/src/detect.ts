import { execFileSync } from "node:child_process";
import { log } from "./logger.js";

const WHICH = process.platform === "win32" ? "where" : "which";

export function hasBinary(name: string): boolean {
  try {
    execFileSync(WHICH, [name], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function checkBinary(name: string, installHint: string): void {
  if (!hasBinary(name)) {
    throw new Error(`[envlock] '${name}' not found in PATH.\n${installHint}`);
  }
  log.debug(`Binary check: ${name} found`);
}
