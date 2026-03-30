import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { rewriteScripts } from "./postinstall.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `envlock-postinstall-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writePackageJson(scripts: Record<string, string>) {
  writeFileSync(
    join(tmpDir, "package.json"),
    JSON.stringify({ name: "test-app", scripts }, null, 2),
  );
}

function readPackageJson(): { scripts: Record<string, string> } {
  return JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8"));
}

describe("rewriteScripts", () => {
  it("rewrites next dev to envlock dev", () => {
    writePackageJson({ dev: "next dev" });
    rewriteScripts(tmpDir);
    expect(readPackageJson().scripts.dev).toBe("envlock dev");
  });

  it("rewrites next build to envlock build", () => {
    writePackageJson({ build: "next build" });
    rewriteScripts(tmpDir);
    expect(readPackageJson().scripts.build).toBe("envlock build");
  });

  it("rewrites next start to envlock start", () => {
    writePackageJson({ start: "next start" });
    rewriteScripts(tmpDir);
    expect(readPackageJson().scripts.start).toBe("envlock start");
  });

  it("is idempotent — does not double-wrap already rewritten scripts", () => {
    writePackageJson({ dev: "envlock dev", build: "envlock build" });
    rewriteScripts(tmpDir);
    const pkg = readPackageJson();
    expect(pkg.scripts.dev).toBe("envlock dev");
    expect(pkg.scripts.build).toBe("envlock build");
  });

  it("does not touch unrelated scripts", () => {
    writePackageJson({ dev: "next dev", lint: "eslint ." });
    rewriteScripts(tmpDir);
    expect(readPackageJson().scripts.lint).toBe("eslint .");
  });

  it("does not touch scripts that already use envlock", () => {
    writePackageJson({ dev: "envlock dev --turbopack" });
    rewriteScripts(tmpDir);
    expect(readPackageJson().scripts.dev).toBe("envlock dev --turbopack");
  });

  it("does not crash when package.json has no scripts field", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "x" }));
    expect(() => rewriteScripts(tmpDir)).not.toThrow();
  });

  it("does not crash when package.json does not exist", () => {
    expect(() => rewriteScripts(join(tmpDir, "nonexistent"))).not.toThrow();
  });
});
