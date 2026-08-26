import { eq } from "drizzle-orm";
import type { Database } from "./db";
import { db as defaultDb } from "./db";
import { accounts } from "./db/schema";
import type { Account } from "./types";

/**
 * Stand-in for auth. NextAuth replaces this in the next milestone; every
 * caller already goes through it, so the swap stays contained to this file.
 */
export const DEV_ACCOUNT_ID = "acc-faisal";

export async function currentAccount(database: Database = defaultDb): Promise<Account> {
  const [row] = await database
    .select().from(accounts).where(eq(accounts.id, DEV_ACCOUNT_ID)).limit(1);
  if (!row) {
    throw new Error(
      "No account found — run `npm run db:seed` against this database first.",
    );
  }
  return {
    ...row,
    verifiedAt: row.verifiedAt ?? undefined,
    frozenAt: row.frozenAt ?? undefined,
    frozenReason: row.frozenReason ?? undefined,
    assignedAm: row.assignedAm ?? undefined,
  };
}
