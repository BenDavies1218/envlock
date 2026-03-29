import { describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

vi.mock("./detect.js", () => ({
  checkBinary: vi.fn(),
}));

vi.mock("./logger.js", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  setVerbose: vi.fn(),
}));

const { spawnSync } = await import("node:child_process");
const { runWithSecrets } = await import("./invoke.js");

const BASE_OPTS = {
  envFile: ".env.development",
  environment: "development" as const,
  onePasswordEnvId: "test-env-id",
  command: "node",
  args: ["server.js"],
};

describe("runWithSecrets", () => {
  it("exits with the subprocess status code on success", () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0, error: undefined } as any);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    runWithSecrets({ ...BASE_OPTS, onePasswordEnvId: undefined as any });
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });

  it("throws when spawnSync returns an error (OS-level failure)", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: null,
      error: new Error("ENOENT: op not found"),
    } as any);
    expect(() => runWithSecrets(BASE_OPTS)).toThrow(/Failed to spawn.*ENOENT/i);
  });

  it("exits with code 1 when status is null and no error", () => {
    vi.mocked(spawnSync).mockReturnValue({ status: null, error: undefined } as any);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    runWithSecrets(BASE_OPTS);
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
