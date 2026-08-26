/** Seeds the configured database. Idempotent — see lib/db/seed.ts. */
import { config } from "dotenv";

// Next loads .env.local automatically; a bare tsx script does not.
config({ path: ".env.local" });
config();

import { seed } from "../lib/db/seed";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — refusing to guess a target.");
    process.exit(1);
  }
  await seed();
  console.log("seeded");
  // The driver holds an open pool; nothing else keeps this process alive.
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
