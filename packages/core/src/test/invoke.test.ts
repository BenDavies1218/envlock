import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

vi.mock("../detect.js", () => ({
  checkBinary: vi.fn(),
}));

vi.mock("../logger.js", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  setVerbose: vi.fn(),
}));

vi.mock("@dotenvx/dotenvx", () => ({
  config: vi.fn(),
}));

const { spawnSync } = await import("node:child_process");
const { config: dotenvxConfig } = await import("@dotenvx/dotenvx");
const { runWithSecrets } = await import("../invoke.js");

const BASE_OPTS = {
  envFile: ".env.development",
  environment: "development" as const,
  onePasswordEnvId: "test-env-id",
  command: "node",
  args: ["server.js"],
};

describe("runWithSecrets", () => {
  beforeEach(() => {
    delete process.env["DOTENV_PRIVATE_KEY_DEVELOPMENT"];
    vi.clearAllMocks();
  });

  describe("when key is not yet injected", () => {
    it("re-invokes via op run and exits with its status", async () => {
      vi.mocked(spawnSync).mockReturnValue({ status: 0, error: undefined } as any);
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
      await runWithSecrets(BASE_OPTS);
      expect(vi.mocked(spawnSync).mock.calls[0]![0]).toBe("op");
      expect(exitSpy).toHaveBeenCalledWith(0);
      exitSpy.mockRestore();
    });

    it("throws when op fails to spawn", async () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: null,
        error: new Error("ENOENT: op not found"),
      } as any);
      await expect(runWithSecrets(BASE_OPTS)).rejects.toThrow(/Failed to spawn.*op/i);
    });

    it("exits with 1 when op status is null and no error", async () => {
      vi.mocked(spawnSync).mockReturnValue({ status: null, error: undefined } as any);
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
      await runWithSecrets(BASE_OPTS);
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });
  });

  describe("when key is already injected", () => {
    beforeEach(() => {
      process.env["DOTENV_PRIVATE_KEY_DEVELOPMENT"] = "test-key";
    });

    it("uses dotenvx config API and spawns command directly", async () => {
      vi.mocked(spawnSync).mockReturnValue({ status: 0, error: undefined } as any);
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
      await runWithSecrets(BASE_OPTS);
      expect(dotenvxConfig).toHaveBeenCalledWith({ path: ".env.development" });
      expect(vi.mocked(spawnSync).mock.calls[0]![0]).toBe("node");
      expect(exitSpy).toHaveBeenCalledWith(0);
      exitSpy.mockRestore();
    });

    it("throws when command fails to spawn", async () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: null,
        error: new Error("ENOENT: node not found"),
      } as any);
      await expect(runWithSecrets(BASE_OPTS)).rejects.toThrow(/Failed to spawn.*node/i);
    });
  });
});
