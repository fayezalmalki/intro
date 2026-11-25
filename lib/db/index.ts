import { env } from "cloudflare:workers";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = DrizzleD1Database<typeof schema>;

/**
 * D1 through Drizzle.
 *
 * D1 has no interactive transactions. Multi-statement writes that must land
 * together go through `database.batch([...])`, which D1 runs atomically. The
 * one place that needs read-then-write serialisation — a send debiting a
 * credit — runs inside the per-account AccountGate Durable Object instead
 * (worker/account-gate.ts).
 */
export function dbFrom(d1: D1Database): Database {
  return drizzle(d1, { schema });
}

let cached: { d1: D1Database; db: Database } | undefined;

/** The database for the current Worker's D1 binding. */
export function resolveDb(): Database {
  const d1 = (env as unknown as { DB: D1Database }).DB;
  if (cached?.d1 !== d1) cached = { d1, db: dbFrom(d1) };
  return cached.db;
}

/**
 * A lazily-resolved handle so call sites keep `import { db }`. The binding is
 * read on use, not at module evaluation, so importing this module never
 * touches D1.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property) {
    const resolved = resolveDb();
    const value = Reflect.get(resolved as object, property);
    return typeof value === "function" ? value.bind(resolved) : value;
  },
});

export { schema };
