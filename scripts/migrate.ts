/**
 * Applies generated drizzle migrations.
 *
 * Run as an explicit deploy step (`npm run db:migrate`), never from `build` —
 * a preview deploy pointed at the production DATABASE_URL would otherwise run
 * DDL against production. See docs/03-design-review.md §5.
 *
 * Prefer an unpooled connection: pgbouncer in transaction mode can mangle DDL
 * and prepared statements. Neon exposes both as DATABASE_URL_UNPOOLED and
 * DATABASE_URL.
 */
import { config } from "dotenv";

// Next loads .env.local automatically; a bare tsx script does not.
config({ path: ".env.local" });
config();

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL.");
    process.exit(1);
  }

  const client = postgres(url, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
  console.log("migrations applied");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
