import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.containers.test.ts"],
    globalSetup: ["./src/test/containers/global-setup.ts"],
    setupFiles: ["./src/test/containers/setup-env.ts"],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
});
