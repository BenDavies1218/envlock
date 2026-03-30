import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REWRITES: Array<{ from: RegExp; to: string; cmd: string }> = [
  { from: /(?<![envlock\s])next dev/, to: "envlock dev", cmd: "dev" },
  { from: /(?<![envlock\s])next build/, to: "envlock build", cmd: "build" },
  { from: /(?<![envlock\s])next start/, to: "envlock start", cmd: "start" },
];

export function rewriteScripts(projectRoot: string): void {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return;

  let pkg: { scripts?: Record<string, string> };
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch {
    return;
  }

  if (!pkg.scripts) return;

  let changed = false;
  for (const { from, to, cmd } of REWRITES) {
    const script = pkg.scripts[cmd];
    if (!script) continue;
    if (script.includes("envlock")) continue;
    if (!from.test(script)) continue;
    pkg.scripts[cmd] = script.replace(from, to);
    console.log(`[envlock] Updated scripts.${cmd}: "${script}" → "${pkg.scripts[cmd]}"`);
    changed = true;
  }

  if (changed) {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }
}

// Entry point — runs when executed as a script
const projectRoot = process.env["INIT_CWD"];
if (projectRoot) {
  rewriteScripts(projectRoot);
}
