import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  target: "node18",
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["vite"],
});
