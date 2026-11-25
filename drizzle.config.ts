import type { Config } from "drizzle-kit";

/**
 * D1 (SQLite). `npm run db:generate` writes SQL migrations to ./drizzle; they
 * are applied with `cf d1 migrations apply` (see package.json db:migrate:*),
 * as an explicit deploy step — never during a build.
 */
export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  strict: true,
} satisfies Config;
