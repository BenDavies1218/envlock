import { describe, expect, it, vi } from "vitest";
import { withEnvlock } from "./plugin.js";

describe("withEnvlock", () => {
  it("attaches __envlock to the Next.js config", () => {
    const result = withEnvlock({}, { onePasswordEnvId: "abc123" });
    expect(result.__envlock.onePasswordEnvId).toBe("abc123");
  });

  it("merges with existing Next.js config without overwriting it", () => {
    const result = withEnvlock(
      { reactStrictMode: true },
      { onePasswordEnvId: "abc123" },
    );
    expect(result.reactStrictMode).toBe(true);
    expect(result.__envlock.onePasswordEnvId).toBe("abc123");
  });

  it("preserves custom envFiles in __envlock", () => {
    const result = withEnvlock(
      {},
      {
        onePasswordEnvId: "abc123",
        envFiles: { staging: ".env.custom-staging" },
      },
    );
    expect(result.__envlock.envFiles?.staging).toBe(".env.custom-staging");
  });

  it("warns when onePasswordEnvId is not provided", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    withEnvlock({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[envlock]"));
    warn.mockRestore();
  });

  it("warns when onePasswordEnvId is an empty string", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    withEnvlock({}, { onePasswordEnvId: "" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[envlock]"));
    warn.mockRestore();
  });

  it("does not warn when onePasswordEnvId is valid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    withEnvlock({}, { onePasswordEnvId: "ca6uypwvab5mevel44gqdc2zae" });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
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
