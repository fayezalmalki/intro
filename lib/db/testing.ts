import { env } from "cloudflare:workers";
import { dbFrom, type Database } from "./index";

/**
 * The test database: the local D1 that the vitest Workers pool provides, with
 * the real migrations applied (lib/__tests__/setup.ts). Same SQLite engine,
 * constraints and unique indexes as production.
 */
export async function testDb(): Promise<Database> {
  return dbFrom((env as unknown as { DB: D1Database }).DB);
}

/** Empties every application table, preserving the schema. Call in beforeEach. */
export async function reset(_db?: Database): Promise<void> {
  const d1 = (env as unknown as { DB: D1Database }).DB;
  const { results } = await d1
    .prepare(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '_cf_%' and name != 'd1_migrations'",
    )
    .all<{ name: string }>();
  await d1.batch([
    d1.prepare("PRAGMA defer_foreign_keys = on"),
    ...results.map((t) => d1.prepare(`delete from "${t.name}"`)),
  ]);
}
