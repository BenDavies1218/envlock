import { execFileSync } from "node:child_process";

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
    console.error(`[envlock] '${name}' not found in PATH.\n${installHint}`);
    process.exit(1);
  }
}
