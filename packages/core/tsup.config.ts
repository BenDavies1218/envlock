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
    clean: false, // don't wipe the library dist already written by the first entry
    outDir: "dist",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
