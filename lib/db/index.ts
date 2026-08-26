import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;

/**
 * Three drivers, one exported type:
 *
 *   neon-http     production. Stateless, so it is safe on serverless and edge,
 *                 and the DrizzleAdapter recognises it.
 *   postgres-js   local development against plain Postgres, and the driver RLS
 *                 will need — it holds a session, so `SET LOCAL app.account_id`
 *                 works. Kept deliberately: see docs/03-design-review.md.
 *   pglite        tests. Postgres compiled to WASM, in-process, no service.
 *
 * DATABASE_URL may be absent at build time (preview deploys, CI), so neon()
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
  const sql = neon(process.env.DATABASE_URL ?? "postgresql://build:placeholder@localhost/db");
  return drizzleNeon(sql, { schema });
}

export const db = createDb();
export { schema };
