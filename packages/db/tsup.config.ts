import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "generated/prisma/client": "src/generated/prisma/client.ts",
  },
  format: ["esm"],
  tsconfig: "tsconfig.build.json",
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["@prisma/client", "@prisma/adapter-pg", "pg"],
});
