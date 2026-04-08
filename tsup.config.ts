import { defineConfig } from "tsup";

import packageJson from "./package.json";

export default defineConfig({
  entry: ["src/index.ts"],
  target: "node18",
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["vite"],
  define: {
    __PACKAGE_VERSION__: JSON.stringify(packageJson.version),
  },
});
