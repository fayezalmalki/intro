/**
 * Writes drizzle/seed/<target>.sql from the seed data in lib/seed.ts, to be
 * applied with `cf d1 execute`-style tooling (see package.json db:seed:*).
 *
 *   npx tsx scripts/seed.ts graph   people graph + ready lists (production-safe)
 *   npx tsx scripts/seed.ts demo    graph + fictional demo accounts (dev only)
 *
 * The SQL is produced by Drizzle itself through the sqlite-proxy driver, which
 * hands each statement and its parameters to a callback instead of a database,
 * so the column mapping stays the schema's and never drifts from it.
 * Every statement is INSERT … ON CONFLICT DO NOTHING, so re-running is a no-op.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../lib/db/schema";
import { SEED_ACCOUNTS, SEED_LISTS, SEED_PEOPLE } from "../lib/seed";

const statements: string[] = [];

function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return String(value.getTime());
  return `'${String(value).replace(/'/g, "''")}'`;
}

const db = drizzle(async (query, params) => {
  let i = 0;
  statements.push(query.replace(/\?/g, () => literal(params[i++])) + ";");
  return { rows: [] };
}, { schema });

async function graph(): Promise<void> {
  for (const person of SEED_PEOPLE) {
    await db.insert(schema.people).values(person).onConflictDoNothing();
  }
  for (const list of SEED_LISTS) {
    await db.insert(schema.peopleLists)
      .values({ id: list.id, name: list.name, description: list.desc })
      .onConflictDoNothing();
    for (const personId of list.personIds) {
      await db.insert(schema.listMembers).values({ listId: list.id, personId }).onConflictDoNothing();
    }
  }
}

async function demo(): Promise<void> {
  for (const account of SEED_ACCOUNTS) {
    // Deterministic user id per demo account, so the account row can reference it.
    const userId = `demo-user-${account.id}`;
    await db.insert(schema.authUsers)
      .values({ id: userId, email: account.email, name: account.displayName, emailVerified: true })
      .onConflictDoNothing();
    await db.insert(schema.accounts).values({ ...account, userId }).onConflictDoNothing();
  }
}

async function main(): Promise<void> {
  const target = process.argv[2] ?? "graph";
  if (target !== "graph" && target !== "demo") throw new Error(`unknown seed target ${target}`);
  await graph();
  if (target === "demo") await demo();
  mkdirSync("drizzle/seed", { recursive: true });
  const out = `drizzle/seed/${target}.sql`;
  writeFileSync(out, statements.join("\n") + "\n");
  console.log(`wrote ${statements.length} statements to ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
