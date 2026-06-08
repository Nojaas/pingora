import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  sourcemap: true,
  clean: true,
  external: [
    "@pingora/db",
    "@pingora/shared",
    "@prisma/adapter-pg",
    "@prisma/client",
    "bullmq",
    "ioredis",
    "pg",
  ],
});
