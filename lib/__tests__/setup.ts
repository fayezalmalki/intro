import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";

// Applies drizzle/*.sql to this test file's D1. Idempotent: applyD1Migrations
// records what it ran and skips it next time.
const testEnv = env as unknown as { DB: D1Database; TEST_MIGRATIONS: D1Migration[] };
await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
