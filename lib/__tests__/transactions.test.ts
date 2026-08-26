import { beforeEach, describe, expect, it } from "vitest";
import { reset, testDb } from "../db/testing";
import { accounts, authUsers, ledger } from "../db/schema";
import type { Database } from "../db";

/**
 * The reason the driver changed. `neon-http` throws "No transactions support",
 * which would leave a credit debited for a send that never happened. These
 * prove the API the repo layer is about to be built on actually works.
 */
describe("transactions", () => {
  let db: Database;
  let accountId: string;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    const [user] = await db.insert(authUsers).values({ email: "f@x.sa" }).returning();
    const [account] = await db
      .insert(accounts)
      .values({ userId: user.id, displayName: "فيصل", initial: "F", email: "f@x.sa" })
      .returning();
    accountId = account.id;
  });

  it("commits every write together", async () => {
    await db.transaction(async (tx) => {
      await tx.insert(ledger).values({ accountId, delta: 10, reason: "purchase", ref: "inv_1" });
      await tx.insert(ledger).values({ accountId, delta: -1, reason: "send", ref: "p-noura" });
    });
    expect(await db.select().from(ledger)).toHaveLength(2);
  });

  it("rolls back the debit when a later write fails", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(ledger).values({ accountId, delta: -1, reason: "send", ref: "p-noura" });
        throw new Error("send failed after the debit");
      }),
    ).rejects.toThrow("send failed after the debit");

    // The whole point: no charge survives a failed send.
    expect(await db.select().from(ledger)).toHaveLength(0);
  });

  it("rolls back when a constraint rejects a duplicate grant mid-transaction", async () => {
    await db.insert(ledger).values({ accountId, delta: 10, reason: "purchase", ref: "inv_1" });
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(ledger).values({ accountId, delta: -1, reason: "send", ref: "p-layan" });
        // A replayed payment webhook — the unique index rejects it.
        await tx.insert(ledger).values({ accountId, delta: 10, reason: "purchase", ref: "inv_1" });
      }),
    ).rejects.toThrow();

    const rows = await db.select().from(ledger);
    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe("purchase");
  });
});
