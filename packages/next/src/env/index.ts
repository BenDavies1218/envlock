import { createEnv as t3CreateEnv } from "@t3-oss/env-nextjs";

type CreateEnvArgs = Parameters<typeof t3CreateEnv>[0];

export function createEnv(options: CreateEnvArgs) {
  return t3CreateEnv({
    skipValidation: !!process.env["SKIP_ENV_VALIDATION"],
    emptyStringAsUndefined: true,
    ...options,
  });
}
