import fs from "node:fs";
import path from "node:path";
import type { Db } from "./types";
import { emptyDb } from "./seed";
import { assertStoreUsable } from "./env";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

/**
 * A JSON-file store so the MVP runs with zero external services. Every access
 * goes through read()/write() so the Supabase swap stays contained to this file.
 */
function read(): Db {
  assertStoreUsable();
  if (!fs.existsSync(DB_PATH)) {
    const db = emptyDb();
    write(db);
    return db;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as Db;
}

function write(db: Db): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export function getDb(): Db {
  return read();
}

export function mutate<T>(fn: (db: Db) => T): T {
  const db = read();
  const result = fn(db);
  write(db);
  return result;
}

export function resetDb(): void {
  write(emptyDb());
}

export function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function audit(
  db: Db,
  actor: string,
  entity: string,
  action: string,
  detail: string,
): void {
  db.audit.unshift({
    id: id("ev"),
    at: new Date().toISOString(),
    actor,
    entity,
    action,
    detail,
  });
}
