import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgresql://localhost/intro" },
  // Generated migrations are applied by `npm run db:migrate` as an explicit
  // deploy step — never during `next build`, where a preview deploy sharing
  // DATABASE_URL would run DDL against production.
  strict: true,
} satisfies Config;
