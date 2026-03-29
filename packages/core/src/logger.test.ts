import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Must isolate module between tests so verbose state resets
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("log.debug", () => {
  it("does not write when verbose is false (default)", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { log } = await import("./logger.js");
    log.debug("hello");
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("writes to stderr when verbose is true", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { log, setVerbose } = await import("./logger.js");
    setVerbose(true);
    log.debug("hello");
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[envlock:debug] hello\n"));
  });
});

describe("log.warn", () => {
  it("always writes to stderr", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { log } = await import("./logger.js");
    log.warn("something wrong");
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[envlock] Warning: something wrong\n"));
  });
});

describe("log.error", () => {
  it("always writes to stderr", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { log } = await import("./logger.js");
    log.error("fatal");
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[envlock] Error: fatal\n"));
  });
});

describe("log.info", () => {
  it("always writes to stderr", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { log } = await import("./logger.js");
    log.info("running");
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[envlock] running\n"));
  });
});

describe("setVerbose", () => {
  it("can be toggled back off", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { log, setVerbose } = await import("./logger.js");
    setVerbose(true);
    setVerbose(false);
    log.debug("should not appear");
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
