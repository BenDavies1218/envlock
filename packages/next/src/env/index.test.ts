import { describe, expect, it, vi } from "vitest";

vi.mock("@t3-oss/env-nextjs", () => ({
  createEnv: vi.fn((opts: unknown) => opts),
}));

const { createEnv } = await import("./index.js");
const { createEnv: t3CreateEnv } = await import("@t3-oss/env-nextjs");

describe("createEnv", () => {
  it("applies emptyStringAsUndefined: true by default", () => {
    createEnv({ server: {}, client: {}, runtimeEnv: {} });
    expect(t3CreateEnv).toHaveBeenCalledWith(
      expect.objectContaining({ emptyStringAsUndefined: true }),
    );
  });

  it("reads skipValidation from SKIP_ENV_VALIDATION env var", () => {
    process.env["SKIP_ENV_VALIDATION"] = "1";
    createEnv({ server: {}, client: {}, runtimeEnv: {} });
    expect(t3CreateEnv).toHaveBeenCalledWith(
      expect.objectContaining({ skipValidation: true }),
    );
    delete process.env["SKIP_ENV_VALIDATION"];
  });

  it("does not skip validation when SKIP_ENV_VALIDATION is unset", () => {
    delete process.env["SKIP_ENV_VALIDATION"];
    createEnv({ server: {}, client: {}, runtimeEnv: {} });
    expect(t3CreateEnv).toHaveBeenCalledWith(
      expect.objectContaining({ skipValidation: false }),
    );
  });

  it("allows caller to override emptyStringAsUndefined", () => {
    createEnv({ server: {}, client: {}, runtimeEnv: {}, emptyStringAsUndefined: false });
    expect(t3CreateEnv).toHaveBeenCalledWith(
      expect.objectContaining({ emptyStringAsUndefined: false }),
    );
  });

  it("allows caller to override skipValidation", () => {
    createEnv({ server: {}, client: {}, runtimeEnv: {}, skipValidation: true });
    expect(t3CreateEnv).toHaveBeenCalledWith(
      expect.objectContaining({ skipValidation: true }),
    );
  });
});
