import { describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

const { execFileSync } = await import("node:child_process");
const { checkBinary, hasBinary } = await import("./detect.js");

describe("hasBinary", () => {
  it("returns true when binary is found", () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.from("/usr/bin/node\n"));
    expect(hasBinary("node")).toBe(true);
  });

  it("returns false when binary is not found", () => {
    vi.mocked(execFileSync).mockImplementation(() => { throw new Error("not found"); });
    expect(hasBinary("nonexistent-tool")).toBe(false);
  });
});

describe("checkBinary", () => {
  it("does not throw when binary exists", () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.from("/usr/bin/node\n"));
    expect(() => checkBinary("node", "install node")).not.toThrow();
  });

  it("throws an Error with the install hint when binary is missing", () => {
    vi.mocked(execFileSync).mockImplementation(() => { throw new Error("not found"); });
    expect(() => checkBinary("dotenvx", "npm install -g @dotenvx/dotenvx")).toThrow(
      /dotenvx.*not found|npm install -g @dotenvx\/dotenvx/i,
    );
  });

  it("thrown error is an instance of Error (not a process.exit)", () => {
    vi.mocked(execFileSync).mockImplementation(() => { throw new Error("not found"); });
    expect(() => checkBinary("op", "brew install 1password-cli")).toThrowError(Error);
  });
});
