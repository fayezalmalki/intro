import { eq } from "drizzle-orm";
import type { Database } from "./index";
import { db as defaultDb } from "./index";
import { accounts, authUsers, listMembers, people, peopleLists } from "./schema";
import { SEED_ACCOUNTS, SEED_LISTS, SEED_PEOPLE } from "../seed";

/**
 * The people graph: safe to run against production, and necessary there — with
 * no people, an AI-drafted pipeline comes back empty and there is nothing for
 * an account manager to review.
 *
 * The explicit ids matter and are not incidental: lib/sourcing.ts keys its
 * sourced evidence off these stable person ids. Letting Postgres generate
 * UUIDs instead would leave every drafted row with no evidence — and since the
 * evidence gate refuses rows without a source, the review console would
 * silently stop being able to approve anything.
 *
 * Idempotent.
 */
export async function seedGraph(database: Database = defaultDb): Promise<void> {
  for (const person of SEED_PEOPLE) {
    await database.insert(people).values(person).onConflictDoNothing();
  }

  for (const list of SEED_LISTS) {
    await database
      .insert(peopleLists)
      .values({ id: list.id, name: list.name, description: list.desc })
      .onConflictDoNothing();
    for (const personId of list.personIds) {
      await database.insert(listMembers).values({ listId: list.id, personId }).onConflictDoNothing();
    }
  }
}

/**
 * Fictional accounts, for development and tests only.
 *
 * Deliberately not reachable from `npm run db:seed`: in production, accounts
 * come from real sign-ins via lib/session.ts, and a seeded account manager
 * nobody can sign in as would just be a name attached to other people's work.
 */
export async function seedDemoAccounts(database: Database = defaultDb): Promise<void> {
  for (const account of SEED_ACCOUNTS) {
    const [existing] = await database
      .select().from(authUsers).where(eq(authUsers.email, account.email)).limit(1);
    const user =
      existing ??
      (await database.insert(authUsers).values({ email: account.email }).returning())[0];

    await database
      .insert(accounts)
      .values({ ...account, userId: user.id })
      .onConflictDoNothing();
  }
}
