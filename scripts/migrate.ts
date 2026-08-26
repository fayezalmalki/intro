/**
 * Applies generated drizzle migrations.
 *
 * Run as an explicit deploy step (`npm run db:migrate`), never from `build` —
 * a preview deploy pointed at the production DATABASE_URL would otherwise run
 * DDL against production. See docs/03-design-review.md §5.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — refusing to guess a target.");
  process.exit(1);
}

await migrate(drizzle(neon(url)), { migrationsFolder: "./drizzle" });
console.log("migrations applied");
