import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Says which part of the setup is missing, in order, so an opaque 500 becomes
 * a URL that names the problem.
 *
 * This exists because production once came up with a reachable database and
 * no tables — migrations had skipped — and the only signal was an error
 * digest. Reports state, never secrets.
 */
type Check = { name: string; ok: boolean; detail?: string };

type HealthEnv = {
  ANTHROPIC_API_KEY?: string;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  EMAIL?: unknown;
  ACCOUNT_GATE?: unknown;
  DB?: unknown;
  ADMIN_EMAILS?: string;
};

/**
 * Settings the app degrades *through* rather than dies on, so they belong
 * beside the checks rather than among them.
 *
 * Booleans only: whether a setting is present, never its value, its length,
 * or a masked prefix of it.
 */
function configuration(e: HealthEnv): Record<string, boolean> {
  return {
    // Mirrors lib/intent.ts: without a key it falls back to keyword extraction.
    intent_extractor: Boolean(e.ANTHROPIC_API_KEY),
    mailer: Boolean(e.EMAIL),
    google_oauth: Boolean(e.GOOGLE_CLIENT_ID),
  };
}

export async function GET(): Promise<Response> {
  const e = env as unknown as HealthEnv;
  const adminEmails = e.ADMIN_EMAILS ?? process.env.ADMIN_EMAILS;
  const checks: Check[] = [];

  // Fatal, unlike the settings in configuration(). Without the secret there is
  // no session at all; without ADMIN_EMAILS no account can ever become an
  // admin, so nobody can grant a role or verify an account.
  checks.push({
    name: "auth_secret_configured",
    ok: Boolean(e.BETTER_AUTH_SECRET),
    detail: e.BETTER_AUTH_SECRET ? undefined : "BETTER_AUTH_SECRET is not set — sign-in cannot work on this deployment.",
  });
  checks.push({
    name: "admin_emails_configured",
    ok: Boolean(adminEmails?.trim()),
    detail: adminEmails?.trim() ? undefined : "ADMIN_EMAILS is not set — no account can be provisioned as an admin.",
  });
  checks.push({
    name: "account_gate_bound",
    ok: Boolean(e.ACCOUNT_GATE),
    detail: e.ACCOUNT_GATE ? undefined : "The ACCOUNT_GATE Durable Object binding is missing — sends cannot run.",
  });
  checks.push({
    name: "database_bound",
    ok: Boolean(e.DB),
    detail: e.DB ? undefined : "The DB (D1) binding is missing on this deployment.",
  });

  if (e.DB) {
    try {
      await db.run(sql`select 1`);
      checks.push({ name: "database_reachable", ok: true });

      const tables = await db.all<{ name: string }>(
        sql`select name from sqlite_master where type = 'table'`,
      );
      const names = new Set(tables.map((r) => r.name));
      const required = ["accounts", "requests", "pipelines", "people", "ledger", "auth_users"];
      const missing = required.filter((t) => !names.has(t));
      checks.push({
        name: "schema_applied",
        ok: missing.length === 0,
        detail: missing.length
          ? `Missing tables: ${missing.join(", ")}. Migrations have not run — \`npm run db:migrate:remote\`.`
          : undefined,
      });

      if (missing.length === 0) {
        const [row] = await db.all<{ n: number }>(sql`select count(*) as n from people`);
        const people = Number(row?.n ?? 0);
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

  // `config` deliberately does not affect the verdict: an endpoint that went
  // red for a deliberate choice (Google sign-in off) would teach us to ignore it.
  const ok = checks.every((c) => c.ok);
  return Response.json({ ok, checks, config: configuration(e) }, { status: ok ? 200 : 503 });
}
