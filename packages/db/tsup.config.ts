import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  tsconfig: "tsconfig.build.json",
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    /\.\/generated\/prisma/,
  ],
  noExternal: [],
});
