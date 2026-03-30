import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    outDir: "dist",
  },
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    dts: false,
    clean: false,
    outDir: "dist",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    entry: { postinstall: "src/postinstall.ts" },
    format: ["cjs"],
    dts: false,
    clean: false,
    outDir: "dist",
  },
]);
