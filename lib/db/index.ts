import { drizzle as drizzleNeon, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import ws from "ws";
import * as schema from "./schema";

export type Database = NeonDatabase<typeof schema>;

// The WebSocket driver needs a constructor; Node has none before 22's global.
neonConfig.webSocketConstructor = globalThis.WebSocket ?? ws;

/**
 * Three drivers, one exported type:
 *
 *   neon-serverless  production. A WebSocket Pool rather than the stateless
 *                    HTTP driver, because `neon-http` throws
 *                    "No transactions support" — and a send debits a credit,
 *                    records an attempt and writes an audit row, which must
 *                    land together or not at all.
 *   postgres-js      local development against plain Postgres, and the driver
 *                    row-level security will need: it holds a session, so
 *                    `SET LOCAL app.account_id` works. See
 *                    drizzle/policies/rls.sql.
 *   pglite           tests. Postgres compiled to WASM, in-process, with the
 *                    same transaction semantics as Neon.
 *
 * DATABASE_URL may be absent at build time (preview deploys, CI), so the pool
 * gets a syntactically valid placeholder rather than throwing during static
 * analysis. No query is ever made on that path.
 */
function createDb(): Database {
  if (process.env.DATABASE_DRIVER === "postgres-js" && process.env.DATABASE_URL) {
    const client = postgres(process.env.DATABASE_URL);
    // The query-builder API is identical across drivers; the cast keeps one
    // exported type for the app while allowing the local driver.
    return drizzlePostgresJs(client, { schema }) as unknown as Database;
  }
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://build:placeholder@localhost/db",
  });
  return drizzleNeon(pool, { schema });
}

export const db = createDb();
export { schema };
