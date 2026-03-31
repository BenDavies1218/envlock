import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "../logger.js";
import { resolveConfig } from "./resolve-config.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `envlock-core-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveConfig", () => {
  it("returns null when no config file exists", async () => {
    const config = await resolveConfig(tmpDir);
    expect(config).toBeNull();
  });

  it("reads onePasswordEnvId from envlock.config.js", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "test-id", commands: { dev: "node server.js" } };`,
    );
    const config = await resolveConfig(tmpDir);
    expect(config?.onePasswordEnvId).toBe("test-id");
  });

  it("reads commands from config", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "test-id", commands: { dev: "node server.js --watch", start: "node server.js" } };`,
    );
    const config = await resolveConfig(tmpDir);
    expect(config?.commands?.dev).toBe("node server.js --watch");
    expect(config?.commands?.start).toBe("node server.js");
  });

  it("reads envFiles from config", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "test-id", envFiles: { production: ".env.prod" } };`,
    );
    const config = await resolveConfig(tmpDir);
    expect(config?.envFiles?.production).toBe(".env.prod");
  });

  it("prefers envlock.config.js over envlock.config.mjs", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "from-js" };`,
    );
    writeFileSync(
      join(tmpDir, "envlock.config.mjs"),
      `export default { onePasswordEnvId: "from-mjs" };`,
    );
    const config = await resolveConfig(tmpDir);
    expect(config?.onePasswordEnvId).toBe("from-js");
  });

  it("falls back to envlock.config.mjs when .js absent", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.mjs"),
      `export default { onePasswordEnvId: "from-mjs" };`,
    );
    const config = await resolveConfig(tmpDir);
    expect(config?.onePasswordEnvId).toBe("from-mjs");
  });

  it("warns and returns null when config has a syntax error", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { this is not valid javascript }`,
    );
    const warn = vi.spyOn(log, "warn").mockImplementation(() => undefined);
    const config = await resolveConfig(tmpDir);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("envlock.config.js"));
    expect(config).toBeNull();
    warn.mockRestore();
  });

  it("returns null and warns when onePasswordEnvId is not a string", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: 42 };`,
    );
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const result = await resolveConfig(tmpDir);
    expect(result).toBeNull();
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("invalid shape"));
    stderrSpy.mockRestore();
  });

  it("returns null and warns when envFiles is not an object", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "my-id", envFiles: "bad" };`,
    );
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const result = await resolveConfig(tmpDir);
    expect(result).toBeNull();
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("invalid shape"));
    stderrSpy.mockRestore();
  });
});
