import { describe, expect, it, vi } from "vitest";
import { withEnvlock } from "../plugin.js";

describe("withEnvlock", () => {
  it("returns the next config unchanged when no options provided", () => {
    const result = withEnvlock({ reactStrictMode: true });
    expect(result.reactStrictMode).toBe(true);
  });

  it("returns the next config unchanged when valid options provided", () => {
    const result = withEnvlock(
      { reactStrictMode: true },
      { onePasswordEnvId: "ca6uypwvab5mevel44gqdc2zae" },
    );
    expect(result.reactStrictMode).toBe(true);
  });

  it("does not attach __envlock to the returned config", () => {
    const result = withEnvlock({}, { onePasswordEnvId: "ca6uypwvab5mevel44gqdc2zae" });
    expect("__envlock" in result).toBe(false);
  });

  it("does not warn when onePasswordEnvId is not provided", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    withEnvlock({});
    expect(stderrSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it("does not warn when valid onePasswordEnvId is provided", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    withEnvlock({}, { onePasswordEnvId: "ca6uypwvab5mevel44gqdc2zae" });
    expect(stderrSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it("throws when onePasswordEnvId contains CLI flag characters", () => {
    expect(() =>
      withEnvlock({}, { onePasswordEnvId: "--no-masking" }),
    ).toThrow(/invalid/i);
  });

  it("throws when onePasswordEnvId contains shell metacharacters", () => {
    expect(() =>
      withEnvlock({}, { onePasswordEnvId: "abc; rm -rf /" }),
    ).toThrow(/invalid/i);
  });
});
