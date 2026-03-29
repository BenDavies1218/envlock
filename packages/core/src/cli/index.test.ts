import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../invoke.js", () => ({
  runWithSecrets: vi.fn(),
}));
vi.mock("../validate.js", () => ({
  validateEnvFilePath: vi.fn(),
  validateOnePasswordEnvId: vi.fn(),
}));

const { runWithSecrets } = await import("../invoke.js");
const { run } = await import("./index.js");

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `envlock-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  vi.clearAllMocks();
  delete process.env["ENVLOCK_OP_ENV_ID"];
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env["ENVLOCK_OP_ENV_ID"];
});

describe("run", () => {
  it("runs ad-hoc command with development env by default", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    await run(["node", "server.js"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js"],
      environment: "development",
    }));
  });

  it("uses production env with --production flag", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    await run(["node", "server.js", "--production"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      environment: "production",
    }));
  });

  it("uses staging env with --staging flag", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    await run(["node", "server.js", "--staging"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      environment: "staging",
    }));
  });

  it("resolves named command from config", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "cfg-id", commands: { dev: "node server.js --watch" } };`,
    );
    await run(["dev"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js", "--watch"],
      environment: "development",
    }));
  });

  it("resolves named command with --production flag", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "cfg-id", commands: { start: "node server.js --port 3000" } };`,
    );
    await run(["start", "--production"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js", "--port", "3000"],
      environment: "production",
    }));
  });

  it("handles quoted arguments in named command", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "cfg-id", commands: { greet: 'node server.js --title "Hello World"' } };`,
    );
    await run(["greet"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js", "--title", "Hello World"],
    }));
  });

  it("throws when first arg matches no config command and no ad-hoc args follow", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "cfg-id", commands: { dev: "node server.js" } };`,
    );
    await expect(run(["unknown"], tmpDir)).rejects.toThrow(/available/i);
  });

  it("throws when no onePasswordEnvId anywhere", async () => {
    await expect(run(["node", "server.js"], tmpDir)).rejects.toThrow(/onePasswordEnvId/i);
  });

  it("uses custom envFile from config", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "cfg-id", envFiles: { production: ".env.prod" }, commands: { start: "node server.js" } };`,
    );
    await run(["start", "--production"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      envFile: ".env.prod",
    }));
  });
});

describe("run subcommand", () => {
  it("executes ad-hoc command bypassing config", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    await run(["run", "node", "server.js"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js"],
      environment: "development",
    }));
  });

  it("passes extra flags through to the command", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    await run(["run", "node", "server.js", "--port", "4000"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js", "--port", "4000"],
    }));
  });

  it("respects --production flag", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    await run(["run", "node", "server.js", "--production"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      environment: "production",
    }));
  });

  it("respects --staging flag", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    await run(["run", "node", "server.js", "--staging"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      environment: "staging",
    }));
  });

  it("throws with usage hint when no command provided after run", async () => {
    // env var set to prevent the onePasswordEnvId guard from throwing before the usage check
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    await expect(run(["run"], tmpDir)).rejects.toThrow(/Usage: envlock run/i);
  });

  it("bypasses named commands in config", async () => {
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "cfg-id", commands: { dev: "node server.js" } };`,
    );
    await run(["run", "python", "app.py"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "python",
      args: ["app.py"],
    }));
  });

  it("warns when config has a reserved 'run' command key", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    writeFileSync(
      join(tmpDir, "envlock.config.js"),
      `export default { onePasswordEnvId: "cfg-id", commands: { run: "node migrate.js" } };`,
    );
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await run(["run", "node", "server.js"], tmpDir);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('"run" is a reserved subcommand'));
    stderrSpy.mockRestore();
  });

  it("strips --debug from argv before processing", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    await run(["--debug", "node", "server.js"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js"],
    }));
  });

  it("strips -d from argv before processing", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "test-id";
    await run(["-d", "node", "server.js"], tmpDir);
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js"],
    }));
  });
});
