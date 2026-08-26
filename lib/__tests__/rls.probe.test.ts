import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

/**
 * Proves drizzle/policies/rls.sql is correct SQL that actually denies a
 * cross-account read — not aspirational text in a file nobody has run.
 *
 * Production uses neon-http, which is stateless and cannot carry
 * `SET LOCAL app.account_id`, so these policies are dormant there. PGlite holds
 * a session exactly as postgres-js will, so this is a faithful rehearsal of the
 * hardening milestone in docs/03-design-review.md §3.
 */
describe("rls policies (dormant in production, rehearsed here)", () => {
  it("deny a cross-account read at the database level", async () => {
    const client = new PGlite();
    const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");

    for (const s of read("drizzle/0000_init.sql").split("--> statement-breakpoint")) {
      if (s.trim()) await client.exec(s.trim());
    }
    await client.exec(read("drizzle/policies/rls.sql"));

    // Superusers and table owners bypass RLS unless it is FORCEd, so the
    // rehearsal runs as an ordinary role — as the app will in production.
    await client.exec(`
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
    `);

    await client.exec(`
      INSERT INTO auth_users (id, email) VALUES ('u-a', 'a@x.sa'), ('u-b', 'b@x.sa');
      INSERT INTO accounts (id, user_id, display_name, initial, email)
        VALUES ('acc-a', 'u-a', 'أحمد', 'A', 'a@x.sa'), ('acc-b', 'u-b', 'بدر', 'B', 'b@x.sa');
      INSERT INTO requests (id, account_id, requester_name, requester_initial, raw_text, status, assigned_am, due_at)
        VALUES ('req-a', 'acc-a', 'أحمد', 'A', 'سري', 'pipeline_ready', 'ريم', now());
      INSERT INTO ledger (id, account_id, delta, reason, ref)
        VALUES ('l-a', 'acc-a', 10, 'purchase', 'inv_a');
    `);

    const asAccount = async (accountId: string, sql: string) => {
      await client.exec("BEGIN");
      await client.exec("SET LOCAL ROLE app_user");
      await client.query("SELECT set_config('app.account_id', $1, true)", [accountId]);
      const res = await client.query(sql);
      await client.exec("COMMIT");
      return res.rows;
    };

    expect(await asAccount("acc-a", "SELECT id FROM requests")).toHaveLength(1);
    expect(await asAccount("acc-b", "SELECT id FROM requests")).toHaveLength(0);

    expect(await asAccount("acc-a", "SELECT id FROM ledger")).toHaveLength(1);
    expect(await asAccount("acc-b", "SELECT id FROM ledger")).toHaveLength(0);

    // No account id set at all must reveal nothing, not everything.
    await client.exec("BEGIN");
    await client.exec("SET LOCAL ROLE app_user");
    const unset = await client.query("SELECT id FROM requests");
    await client.exec("COMMIT");
    expect(unset.rows).toHaveLength(0);
  });
});
