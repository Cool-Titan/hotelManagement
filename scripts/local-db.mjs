// Runs a throwaway local Postgres (no Docker needed) for development and tests.
// Usage: node scripts/local-db.mjs   → listens on 127.0.0.1:54329 until Ctrl+C
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = ".local-pg";
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "kaapi", password: "kaapi-local", port: 54329, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
if (!existsSync(dir)) await pg.initialise();
await pg.start();
for (const name of ["kaapi", "kaapi_test"]) {
  try { await pg.createDatabase(name); } catch { /* already exists */ }
}
console.log("Local Postgres ready: postgresql://kaapi:kaapi-local@127.0.0.1:54329/kaapi (and /kaapi_test)");
const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
