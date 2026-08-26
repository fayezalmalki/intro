import type { Account, Db } from "./types";

/**
 * Stand-in for auth. Milestone 1 replaces this with the Supabase session; every
 * caller already goes through it, so the swap is contained to this file.
 */
export const DEV_ACCOUNT_ID = "acc-faisal";

export function currentAccount(db: Db): Account {
  const account = db.accounts.find((a) => a.id === DEV_ACCOUNT_ID);
  if (!account) throw new Error("no current account — the store was not seeded");
  return account;
}
