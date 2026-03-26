import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createEnv } from "./index.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createEnv", () => {
  it("returns {} when called with no schema", () => {
    const env = createEnv({ runtimeEnv: {} });
    expect(env).toEqual({});
  });

  it("returns {} when SKIP_ENV_VALIDATION is set in runtimeEnv", () => {
    const env = createEnv({
      server: { DB: z.string() },
      runtimeEnv: { DB: "postgres://localhost/db", SKIP_ENV_VALIDATION: "1" },
    });
    expect(env).toEqual({});
  });

  it("returns {} when SKIP_ENV_VALIDATION is set in process.env and no runtimeEnv is supplied", () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    const env = createEnv({
      server: { DB: z.string() },
    });
    expect(env).toEqual({});
  });

  it("coerces empty strings to undefined before validation", () => {
    expect(() =>
      createEnv({
        server: { DB: z.string() },
        runtimeEnv: { DB: "" },
      }),
    ).toThrow("DB");
  });

  it("returns typed parsed object when all fields are valid", () => {
    const env = createEnv({
      server: { PORT: z.coerce.number() },
      client: { NEXT_PUBLIC_URL: z.string().url() },
      runtimeEnv: { PORT: "3000", NEXT_PUBLIC_URL: "https://example.com" },
    });
    expect(env).toEqual({ PORT: 3000, NEXT_PUBLIC_URL: "https://example.com" });
  });

  it("throws listing a single invalid field", () => {
    expect(() =>
      createEnv({
        server: { DATABASE_URL: z.string().url() },
        runtimeEnv: { DATABASE_URL: "not-a-url" },
      }),
    ).toThrow("DATABASE_URL");
  });

  it("throws listing all invalid fields", () => {
    const call = () =>
      createEnv({
        server: { DATABASE_URL: z.string().url(), SECRET: z.string().min(1) },
        runtimeEnv: { DATABASE_URL: "not-a-url", SECRET: "" },
      });
    expect(call).toThrow("DATABASE_URL");
    expect(call).toThrow("SECRET");
  });

  it("merges server and client into a single return object", () => {
    const env = createEnv({
      server: { A: z.string() },
      client: { NEXT_PUBLIC_B: z.string() },
      runtimeEnv: { A: "hello", NEXT_PUBLIC_B: "world" },
    });
    expect(env).toEqual({ A: "hello", NEXT_PUBLIC_B: "world" });
  });

  it("throws when client keys are missing the NEXT_PUBLIC_ prefix", () => {
    expect(() =>
      createEnv({
        client: { API_KEY: z.string(), NEXT_PUBLIC_OK: z.string() },
        runtimeEnv: { API_KEY: "secret", NEXT_PUBLIC_OK: "fine" },
      }),
    ).toThrow("API_KEY");
  });
});
