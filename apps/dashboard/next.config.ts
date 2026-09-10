import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import type { NextConfig } from "next";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(rootDir, ".env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@pingora/shared"],
};

export default nextConfig;
