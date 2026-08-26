import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Says which part of the setup is missing, in order, so an opaque 500 becomes
 * a URL that names the problem.
 *
 * This exists because production came up with a reachable database and no
 * tables — the migrate workflow had skipped — and the only signal was a Next
 * error digest. Reports state, never secrets.
 */
type Check = { name: string; ok: boolean; detail?: string };

/**
 * Drizzle's execute() returns `{ rows }` on the Neon drivers and a bare array
 * on postgres-js. Production is Neon and local development is postgres-js, so
 * a route that assumed either shape would misreport in exactly the place it
 * gets tested.
 */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export async function GET(): Promise<Response> {
  const checks: Check[] = [];

  const configured = Boolean(process.env.DATABASE_URL);
  checks.push({
    name: "database_url_configured",
    ok: configured,
    detail: configured ? undefined : "DATABASE_URL is not set on this deployment.",
  });

  if (configured) {
    try {
      await db.execute(sql`select 1`);
      checks.push({ name: "database_reachable", ok: true });

      const tables = await db.execute(
        sql`select table_name from information_schema.tables where table_schema = 'public'`,
      );
      const names = new Set(rowsOf<{ table_name: string }>(tables).map((r) => r.table_name));
      const required = ["accounts", "requests", "pipelines", "people", "ledger"];
      const missing = required.filter((t) => !names.has(t));
      checks.push({
        name: "schema_applied",
        ok: missing.length === 0,
        detail: missing.length
          ? `Missing tables: ${missing.join(", ")}. Migrations have not run — check the Migrate workflow and that DATABASE_URL_UNPOOLED is set.`
          : undefined,
      });

      if (missing.length === 0) {
        const count = await db.execute(sql`select count(*)::int as n from people`);
        const people = Number(rowsOf<{ n: number }>(count)[0]?.n ?? 0);
        checks.push({
          name: "people_graph_seeded",
          ok: people > 0,
          detail: people > 0
            ? `${people} people`
            : "No people. A request would produce an empty pipeline — run `npm run db:seed`.",
        });
      }
    } catch (error) {
      checks.push({
        name: "database_reachable",
        ok: false,
        detail: error instanceof Error ? error.message : "Unknown database error.",
      });
    }
  }

  const ok = checks.every((c) => c.ok);
  return Response.json({ ok, checks }, { status: ok ? 200 : 503 });
}
