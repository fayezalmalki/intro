/**
 * A local Postgres with nothing to install.
 *
 * PGlite is Postgres compiled to WASM; pglite-socket puts it behind the real
 * Postgres wire protocol on a TCP port, so the app talks to it through the
 * ordinary postgres-js driver. That keeps local development and CI on the same
 * code path as Neon rather than on a second, fake one.
 *
 * Data lives in .data/pg so it survives a restart; delete that to reset.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PGLITE_PORT ?? 5432);
const dataDir = path.join(process.cwd(), ".data", "pg");
const db = await PGlite.create({ dataDir });

// Apply every generated migration, idempotently — the same files db:migrate
// runs against Neon.
const dir = path.join(process.cwd(), "drizzle");
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  const sql = fs.readFileSync(path.join(dir, file), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    try {
      await db.exec(trimmed);
    } catch (e) {
      // CREATE TABLE / CREATE INDEX without IF NOT EXISTS on a second run.
      if (!/already exists/i.test(String(e))) throw e;
    }
  }
}

const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 20 });
await server.start();

// A pidfile, so stopping this server never means pattern-matching process
// command lines — a match that also hits the shell doing the matching.
const pidFile = path.join(process.cwd(), ".data", "pg.pid");
fs.writeFileSync(pidFile, String(process.pid));
console.log(`local postgres on 127.0.0.1:${PORT} (pglite, data in .data/pg)`);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    try { fs.unlinkSync(pidFile); } catch {}
    await server.stop();
    await db.close();
    process.exit(0);
  });
}
