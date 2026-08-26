/**
 * Seeds the people graph. Idempotent, and production-safe: it inserts no
 * accounts. Development and tests use `npm run db:reset`, which also loads the
 * demo accounts.
 */
import { config } from "dotenv";

// Next loads .env.local automatically; a bare tsx script does not.
config({ path: ".env.local" });
config();

import { seedGraph } from "../lib/db/seed";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — refusing to guess a target.");
    process.exit(1);
  }
  await seedGraph();
  console.log("seeded the people graph");
  // The driver holds an open pool; nothing else keeps this process alive.
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
