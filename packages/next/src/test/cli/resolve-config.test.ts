import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "envlock-core";
import { resolveConfig } from "../../cli/resolve-config.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `envlock-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  delete process.env["ENVLOCK_OP_ENV_ID"];
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env["ENVLOCK_OP_ENV_ID"];
});

describe("resolveConfig", () => {
  it("reads onePasswordEnvId from next.config.js with withEnvlock", async () => {
    writeFileSync(
      join(tmpDir, "next.config.js"),
      `export default { __envlock: { onePasswordEnvId: "test-env-id" } };`,
    );
    const config = await resolveConfig(tmpDir);
    expect(config.onePasswordEnvId).toBe("test-env-id");
  });

  it("falls back to ENVLOCK_OP_ENV_ID env var when no config file found", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "env-var-id";
    const config = await resolveConfig(tmpDir);
    expect(config.onePasswordEnvId).toBe("env-var-id");
  });

  it("throws a descriptive error when no config is found anywhere", async () => {
    await expect(resolveConfig(tmpDir)).rejects.toThrow(/withEnvlock/);
  });

  it("skips config files that do not have __envlock and tries the next", async () => {
    writeFileSync(
      join(tmpDir, "next.config.js"),
      `export default { reactStrictMode: true };`,
    );
    process.env["ENVLOCK_OP_ENV_ID"] = "fallback-id";
    const config = await resolveConfig(tmpDir);
    expect(config.onePasswordEnvId).toBe("fallback-id");
  });

  it("prefers next.config.js over next.config.mjs", async () => {
    writeFileSync(
      join(tmpDir, "next.config.js"),
      `export default { __envlock: { onePasswordEnvId: "from-js" } };`,
    );
    writeFileSync(
      join(tmpDir, "next.config.mjs"),
      `export default { __envlock: { onePasswordEnvId: "from-mjs" } };`,
    );
    const config = await resolveConfig(tmpDir);
    expect(config.onePasswordEnvId).toBe("from-js");
  });

  it("validates ENVLOCK_OP_ENV_ID from env var (rejects CLI flag injection)", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "--no-masking";
    await expect(resolveConfig(tmpDir)).rejects.toThrow(/invalid/i);
  });

  it("validates ENVLOCK_OP_ENV_ID from env var (rejects shell metacharacters)", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "abc; rm -rf /";
    await expect(resolveConfig(tmpDir)).rejects.toThrow(/invalid/i);
  });

  it("attempts next.config.ts before next.config.mjs", async () => {
    // Plain JS written to a .ts file — loads natively on Node 22+, falls through on older Node
    writeFileSync(
      join(tmpDir, "next.config.ts"),
      `export default { __envlock: { onePasswordEnvId: "from-ts" } };`,
    );
    writeFileSync(
      join(tmpDir, "next.config.mjs"),
      `export default { __envlock: { onePasswordEnvId: "from-mjs" } };`,
    );
    const config = await resolveConfig(tmpDir);
    // On Node 22+ reads .ts; on older Node falls through to .mjs — both are correct
    expect(["from-ts", "from-mjs"]).toContain(config.onePasswordEnvId);
  });

  it("falls back to next.config.mjs when next.config.ts fails to import", async () => {
    writeFileSync(
      join(tmpDir, "next.config.ts"),
      `this is not valid javascript at all !!!`,
    );
    writeFileSync(
      join(tmpDir, "next.config.mjs"),
      `export default { __envlock: { onePasswordEnvId: "from-mjs-fallback" } };`,
    );
    const config = await resolveConfig(tmpDir);
    expect(config.onePasswordEnvId).toBe("from-mjs-fallback");
  });

  it("warns when a config file has a syntax error instead of silently skipping", async () => {
    writeFileSync(
      join(tmpDir, "next.config.js"),
      `export default { this is not valid javascript }`,
    );
    const warn = vi.spyOn(log, "warn").mockImplementation(() => undefined);
    process.env["ENVLOCK_OP_ENV_ID"] = "fallback-id";
    await resolveConfig(tmpDir);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("next.config.js"));
    warn.mockRestore();
  });

  it("throws when __envlock.onePasswordEnvId is not a string", async () => {
    writeFileSync(
      join(tmpDir, "next.config.js"),
      `export default { __envlock: { onePasswordEnvId: 99 } };`,
    );
    await expect(resolveConfig(tmpDir)).rejects.toThrow(/invalid/i);
  });

  it("throws when __envlock.envFiles is not an object", async () => {
    writeFileSync(
      join(tmpDir, "next.config.js"),
      `export default { __envlock: { onePasswordEnvId: "my-id", envFiles: "bad" } };`,
    );
    await expect(resolveConfig(tmpDir)).rejects.toThrow(/invalid/i);
  });

  it("loads config from next.config.cjs", async () => {
    writeFileSync(
      join(tmpDir, "next.config.cjs"),
      `module.exports = { __envlock: { onePasswordEnvId: "cjs-id" } };`,
    );
    const result = await resolveConfig(tmpDir);
    expect(result.onePasswordEnvId).toBe("cjs-id");
  });
});
