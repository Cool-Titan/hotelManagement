// Applies migrations to the test database (TEST_DATABASE_URL or the local default).
import { execSync } from "node:child_process";
const url = process.env.TEST_DATABASE_URL || "postgresql://kaapi:kaapi-local@127.0.0.1:54329/kaapi_test";
execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url } });
