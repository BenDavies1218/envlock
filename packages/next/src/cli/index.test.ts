import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("envlock-core", () => ({
  ENVIRONMENTS: { development: "development", staging: "staging", production: "production" },
  runWithSecrets: vi.fn(),
  validateEnvFilePath: vi.fn(),
  validateOnePasswordEnvId: vi.fn(),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  setVerbose: vi.fn(),
  findFreePort: vi.fn(),
}));

vi.mock("./resolve-config.js", () => ({
  resolveConfig: vi.fn(),
}));

const { runWithSecrets, validateOnePasswordEnvId, findFreePort, log } = await import("envlock-core");
const { resolveConfig } = await import("./resolve-config.js");
const { handleRunCommand, runNextCommand } = await import("./index.js");

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["ENVLOCK_OP_ENV_ID"];
  vi.mocked(resolveConfig).mockResolvedValue({ onePasswordEnvId: "cfg-id" });
  vi.mocked(findFreePort).mockResolvedValue(3000);
});

afterEach(() => {
  delete process.env["ENVLOCK_OP_ENV_ID"];
});

describe("handleRunCommand", () => {
  it("throws usage hint when no command provided", async () => {
    await expect(handleRunCommand(undefined, [], {})).rejects.toThrow(/Usage: envlock run/i);
  });

  it("runs command with development env by default", async () => {
    await handleRunCommand("node", ["server.js"], {});
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js"],
      environment: "development",
    }));
  });

  it("respects --production flag", async () => {
    await handleRunCommand("node", ["server.js"], { production: true });
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      environment: "production",
    }));
  });

  it("respects --staging flag", async () => {
    await handleRunCommand("node", ["server.js"], { staging: true });
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      environment: "staging",
    }));
  });

  it("throws when no onePasswordEnvId in config or env var", async () => {
    vi.mocked(resolveConfig).mockResolvedValue({});
    await expect(handleRunCommand("node", ["server.js"], {})).rejects.toThrow(/onePasswordEnvId/i);
  });

  it("prefers ENVLOCK_OP_ENV_ID over config onePasswordEnvId", async () => {
    process.env["ENVLOCK_OP_ENV_ID"] = "env-id";
    vi.mocked(resolveConfig).mockResolvedValue({ onePasswordEnvId: "cfg-id" });
    await handleRunCommand("node", ["server.js"], {});
    expect(validateOnePasswordEnvId).toHaveBeenCalledWith("env-id");
  });

  it("passes extra args through to the command", async () => {
    await handleRunCommand("node", ["server.js", "--port", "4000"], {});
    expect(runWithSecrets).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js", "--port", "4000"],
    }));
  });

  it("runs without error given valid inputs", async () => {
    await handleRunCommand("node", ["server.js"], {});
    expect(runWithSecrets).toHaveBeenCalled();
  });
});

describe("runNextCommand port switching", () => {
  it("passes the default port 3000 to next when free", async () => {
    vi.mocked(findFreePort).mockResolvedValue(3000);
    vi.mocked(resolveConfig).mockResolvedValue({ onePasswordEnvId: "id" });

    await runNextCommand("dev", "development", []);

    expect(findFreePort).toHaveBeenCalledWith(3000);
    expect(runWithSecrets).toHaveBeenCalledWith(
      expect.objectContaining({ args: expect.arrayContaining(["-p", "3000"]) }),
    );
  });

  it("logs a notice and switches port when preferred is taken", async () => {
    vi.mocked(findFreePort).mockResolvedValue(3001);
    vi.mocked(resolveConfig).mockResolvedValue({ onePasswordEnvId: "id" });
    const warn = vi.spyOn(log, "warn");

    await runNextCommand("dev", "development", []);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("3001"));
  });

  it("respects an explicit --port arg passed by the user", async () => {
    vi.mocked(findFreePort).mockResolvedValue(4000);
    vi.mocked(resolveConfig).mockResolvedValue({ onePasswordEnvId: "id" });

    await runNextCommand("dev", "development", ["--port", "4000"]);

    expect(findFreePort).toHaveBeenCalledWith(4000);
  });

  it("does not run port switching for build subcommand", async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ onePasswordEnvId: "id" });

    await runNextCommand("build", "production", []);

    expect(findFreePort).not.toHaveBeenCalled();
  });
});
