import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";

// Tests run against a separate database. Defaults match `npm run db:local`;
// override with .env.test or TEST_DATABASE_URL.
const fromFile = loadEnv({ path: ".env.test", quiet: true }).parsed ?? {};
const testUrl = process.env.TEST_DATABASE_URL || fromFile.DATABASE_URL || "postgresql://kaapi:kaapi-local@127.0.0.1:54329/kaapi_test";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    env: {
      SESSION_SECRET: "test-secret-test-secret-test-secret-123",
      ...fromFile,
      DATABASE_URL: testUrl,
      DIRECT_URL: testUrl,
      XAI_API_KEY: "", // tests never call the real AI
    },
    include: ["tests/**/*.test.ts"],
    fileParallelism: false, // DB tests share one database
    testTimeout: 30_000,
  },
});
