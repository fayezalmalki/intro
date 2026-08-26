/**
 * Empties the application tables and re-seeds. Leaves the people graph's
 * stable ids intact, since lib/sourcing.ts keys its sourced evidence off them.
 *
 * Used before an end-to-end run so the flow starts from a known state.
 */
import { config } from "dotenv";

// Next loads .env.local automatically; a bare tsx script does not.
config({ path: ".env.local" });
config();

import { sql } from "drizzle-orm";
import { db } from "../lib/db";
import { seed } from "../lib/db/seed";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — refusing to guess a target.");
    process.exit(1);
  }
  // accounts and auth_users go too: the seeded account is an `observer`, and
  // leaving a previously verified one behind means the send gate is already
  // open before the flow starts.
  await db.execute(sql`
    truncate requests, pipelines, pipeline_items, outreach, send_attempts,
             ledger, audit_events, suppressions, accounts, auth_users cascade
  `);
  await seed();
  console.log("reset and seeded");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
