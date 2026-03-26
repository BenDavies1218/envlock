import { describe, expect, it } from "vitest";
import { z } from "zod";

const { createEnv } = await import("./index.js");

describe("createEnv", () => {
  it("returns {} when called with no arguments", () => {
    const env = createEnv();
    expect(env).toEqual({});
  });

  it("returns {} when SKIP_ENV_VALIDATION is set", () => {
    process.env["SKIP_ENV_VALIDATION"] = "1";
    const env = createEnv({
      server: { DB: z.string() },
      runtimeEnv: { DB: "postgres://localhost/db" },
    });
    expect(env).toEqual({});
    delete process.env["SKIP_ENV_VALIDATION"];
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
    let err: Error | undefined;
    try {
      createEnv({
        server: { DATABASE_URL: z.string().url(), SECRET: z.string().min(1) },
        runtimeEnv: { DATABASE_URL: "not-a-url", SECRET: "" },
      });
    } catch (e) {
      err = e as Error;
    }
    expect(err?.message).toMatch("DATABASE_URL");
    expect(err?.message).toMatch("SECRET");
  });

  it("merges server and client into a single return object", () => {
    const env = createEnv({
      server: { A: z.string() },
      client: { B: z.string() },
      runtimeEnv: { A: "hello", B: "world" },
    });
    expect(env).toEqual({ A: "hello", B: "world" });
  });
});
