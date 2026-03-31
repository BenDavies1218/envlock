import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spinner } from "../spinner.js";

describe("spinner", () => {
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    stderrWrite.mockRestore();
    vi.useRealTimers();
    spinner.stop(); // ensure clean state
  });

  it("is a no-op when stderr is not a TTY", () => {
    // isTTY is undefined in test environment (non-TTY)
    spinner.start("Loading…");
    vi.advanceTimersByTime(200);
    spinner.stop();
    expect(stderrWrite).not.toHaveBeenCalled();
  });

  it("writes frames to stderr when TTY", () => {
    Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
    spinner.start("Loading…");
    vi.advanceTimersByTime(160); // two ticks at 80ms
    expect(stderrWrite).toHaveBeenCalled();
    const calls = stderrWrite.mock.calls.map((c) => c[0] as string);
    expect(calls.some((s) => s.includes("Loading…"))).toBe(true);
    Object.defineProperty(process.stderr, "isTTY", { value: undefined, configurable: true });
    spinner.stop();
  });

  it("clears the line on stop when TTY", () => {
    Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
    spinner.start("Loading…");
    vi.advanceTimersByTime(80);
    spinner.stop();
    const calls = stderrWrite.mock.calls.map((c) => c[0] as string);
    expect(calls.some((s) => s.includes("\x1b[K"))).toBe(true);
    Object.defineProperty(process.stderr, "isTTY", { value: undefined, configurable: true });
  });
});
