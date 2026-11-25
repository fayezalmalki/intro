/**
 * Applies drizzle/*.sql migrations, and optionally the demo seed, to the LOCAL
 * D1 database that `npm run dev` uses (.cloudflare/state).
 *
 *   npm run db:local            migrations only
 *   npm run db:local -- --seed  migrations + demo accounts and people graph
 *   npm run db:local -- --reset delete the local database first
 *
 * Why not `cf d1 migrations apply --local`: it takes a database UUID, and the
 * D1 binding is declared by name (Cloudflare provisions it on first deploy).
 * Locally that database is a plain SQLite file, so Node's built-in sqlite
 * applies the same files and records them in the same `d1_migrations` table
 * Cloudflare's tooling uses.
 *
 * Start `npm run dev` once first so the local database file exists.
 */
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const stateDir = path.join(root, ".cloudflare/state/v3/d1/miniflare-D1DatabaseObject");
const args = new Set(process.argv.slice(2));

function databaseFile(): string {
  if (!existsSync(stateDir)) {
    throw new Error("No local D1 yet. Run `npm run dev` once, open http://localhost:3000/api/health, then retry.");
  }
  const files = readdirSync(stateDir).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  if (files.length !== 1) throw new Error(`Expected one local D1 database in ${stateDir}, found ${files.length}.`);
  return path.join(stateDir, files[0]);
}

if (args.has("--reset") && existsSync(stateDir)) {
  for (const f of readdirSync(stateDir)) {
    if (!f.startsWith("metadata")) {
      const file = path.join(stateDir, f);
      // Empty the database rather than delete it, so a running dev server keeps its handle.
      if (f.endsWith(".sqlite")) {
        const db = new DatabaseSync(file);
        db.exec("PRAGMA foreign_keys = off");
        const tables = db.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '_cf_%'").all() as { name: string }[];
        for (const t of tables) db.exec(`drop table if exists "${t.name}"`);
        db.close();
      } else if (f.endsWith("-shm") || f.endsWith("-wal")) {
        // leave WAL files to SQLite
      } else {
        rmSync(file);
      }
    }
  }
  console.log("reset local D1");
}

const db = new DatabaseSync(databaseFile());
db.exec(`create table if not exists d1_migrations (
  id integer primary key autoincrement,
  name text unique,
  applied_at timestamp not null default current_timestamp
)`);
const applied = new Set((db.prepare("select name from d1_migrations").all() as { name: string }[]).map((r) => r.name));

const migrations = readdirSync(path.join(root, "drizzle")).filter((f) => f.endsWith(".sql")).sort();
for (const name of migrations) {
  if (applied.has(name)) continue;
  const sql = readFileSync(path.join(root, "drizzle", name), "utf8").replaceAll("--> statement-breakpoint", "");
  db.exec("begin");
  try {
    db.exec(sql);
    db.prepare("insert into d1_migrations (name) values (?)").run(name);
    db.exec("commit");
    console.log(`applied ${name}`);
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}

if (args.has("--seed")) {
  execFileSync("npx", ["tsx", "scripts/seed.ts", "demo"], { stdio: "inherit" });
  db.exec(readFileSync(path.join(root, "drizzle/seed/demo.sql"), "utf8"));
  console.log("seeded demo accounts and the people graph");
}

db.close();
