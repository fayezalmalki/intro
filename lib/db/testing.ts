import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import type { Database } from "./index";

/**
 * An ephemeral in-process Postgres for tests — real Postgres compiled to WASM,
 * so migrations, constraints and unique indexes behave exactly as they will in
 * Neon. No service, no DATABASE_URL, nothing to clean up.
 *
 * Booting the WASM image costs a few seconds, so one instance is shared per
 * process and `reset()` truncates between tests instead.
 */
let shared: Promise<Database> | undefined;

function migrationStatements(): string[] {
  const dir = path.join(process.cwd(), "drizzle");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .flatMap((file) =>
      fs
        .readFileSync(path.join(dir, file), "utf8")
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean),
    );
}

async function boot(): Promise<Database> {
  const client = new PGlite();
  for (const statement of migrationStatements()) await client.exec(statement);
  return drizzle(client, { schema }) as unknown as Database;
}

export function testDb(): Promise<Database> {
  shared ??= boot();
  return shared;
}

/** Empties every table, preserving the schema. Call in beforeEach. */
export async function reset(db: Database): Promise<void> {
  await db.execute(sql`
    do $$
    declare t record;
    begin
      for t in select tablename from pg_tables where schemaname = 'public' loop
        execute format('truncate table %I cascade', t.tablename);
      end loop;
    end $$;
  `);
}
