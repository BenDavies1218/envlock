import { sep } from "node:path";
import { describe, expect, it } from "vitest";
import { validateEnvFilePath, validateOnePasswordEnvId } from "./validate.js";

describe("validateOnePasswordEnvId", () => {
  it("accepts valid 1Password environment IDs (lowercase alphanumeric)", () => {
    expect(() => validateOnePasswordEnvId("ca6uypwvab5mevel44gqdc2zae")).not.toThrow();
  });

  it("rejects IDs that start with -- (CLI flag injection)", () => {
    expect(() => validateOnePasswordEnvId("--no-masking")).toThrow(/invalid/i);
  });

  it("rejects IDs containing semicolons (shell metacharacter)", () => {
    expect(() => validateOnePasswordEnvId("abc; rm -rf /")).toThrow(/invalid/i);
  });

  it("rejects IDs containing spaces", () => {
    expect(() => validateOnePasswordEnvId("abc def")).toThrow(/invalid/i);
  });

  it("rejects IDs containing newlines", () => {
    expect(() => validateOnePasswordEnvId("abc\ndef")).toThrow(/invalid/i);
  });

  it("rejects empty string", () => {
    expect(() => validateOnePasswordEnvId("")).toThrow(/invalid/i);
  });
});

describe("validateEnvFilePath", () => {
  const cwd = "/project";

  it("accepts paths within the project directory", () => {
    expect(() => validateEnvFilePath(".env.production", cwd)).not.toThrow();
    expect(() => validateEnvFilePath(".env.staging", cwd)).not.toThrow();
  });

  it("rejects absolute paths outside the project", () => {
    expect(() => validateEnvFilePath("/etc/passwd", cwd)).toThrow(/invalid/i);
  });

  it("rejects relative paths that escape the project directory", () => {
    expect(() => validateEnvFilePath("../../etc/passwd", cwd)).toThrow(/invalid/i);
  });

  it("rejects paths with null bytes", () => {
    expect(() => validateEnvFilePath(".env\x00.production", cwd)).toThrow(/invalid/i);
  });

  it("does not allow a sibling directory that shares a common prefix", () => {
    expect(() =>
      validateEnvFilePath(`..${sep}project-evil${sep}.env`, cwd),
    ).toThrow(/invalid/i);
  });
});
