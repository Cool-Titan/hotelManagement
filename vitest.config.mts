import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";

// Tests run against a separate database (see .env.test / deployment.md).
const env = loadEnv({ path: ".env.test", override: true }).parsed ?? {};

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    env,
    include: ["tests/**/*.test.ts"],
    fileParallelism: false, // DB tests share one database
    testTimeout: 30_000,
  },
});
