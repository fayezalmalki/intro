import { beforeEach, describe, expect, it } from "vitest";
import { reset, testDb } from "../db/testing";
import { accounts, authUsers, ledger } from "../db/schema";
import type { Database } from "../db";

/**
 * D1 has no interactive transactions; lib/db/repo.ts commits every multi-write
 * operation with `db.batch()`. These prove batch is all-or-nothing on D1 — a
 * debit never lands without the writes that go with it.
 */
describe("batch atomicity", () => {
  let db: Database;
  let accountId: string;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    const [user] = await db.insert(authUsers).values({ email: "f@x.sa", name: "f" }).returning();
    const [account] = await db
      .insert(accounts)
      .values({ userId: user.id, displayName: "فيصل", initial: "F", email: "f@x.sa" })
      .returning();
    accountId = account.id;
  });

  it("commits every write together", async () => {
    await db.batch([
      db.insert(ledger).values({ accountId, delta: 10, reason: "purchase", ref: "inv_1" }),
      db.insert(ledger).values({ accountId, delta: -1, reason: "send", ref: "p-noura" }),
    ]);
    expect(await db.select().from(ledger)).toHaveLength(2);
  });

  it("rolls back the debit when a later write in the batch fails", async () => {
    await db.insert(ledger).values({ accountId, delta: 10, reason: "purchase", ref: "inv_1" });
    await expect(
      db.batch([
        db.insert(ledger).values({ accountId, delta: -1, reason: "send", ref: "p-noura" }),
        // Violates ledger_idempotency_idx: the same grant twice.
        db.insert(ledger).values({ accountId, delta: 10, reason: "purchase", ref: "inv_1" }),
      ]),
    ).rejects.toThrow();
    const rows = await db.select().from(ledger);
    expect(rows).toHaveLength(1);
    expect(rows[0].ref).toBe("inv_1");
  });
});
