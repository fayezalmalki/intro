import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { reset, testDb } from "../db/testing";
import { accounts, authUsers, ledger, people, suppressions } from "../db/schema";
import type { Database } from "../db";

describe("migrations", () => {
  let db: Database;
  beforeEach(async () => {
    db = await testDb();
    await reset(db);
  });

  const seedAccount = async () => {
    const [user] = await db.insert(authUsers).values({ email: "f@x.sa" }).returning();
    const [account] = await db
      .insert(accounts)
      .values({ userId: user.id, displayName: "فيصل", initial: "F", email: "f@x.sa" })
      .returning();
    return account;
  };

  it("apply cleanly to an empty Postgres", async () => {
    const rows = await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    const names = (rows.rows as { table_name: string }[]).map((r) => r.table_name);
    expect(names).toContain("accounts");
    expect(names).toContain("ledger");
    expect(names).toContain("send_attempts");
    expect(names).toContain("auth_users");
  });

  /**
   * The guard against a retried StreamPay webhook granting credits twice.
   * This is the difference between a provider retry and free money.
   */
  it("refuses a duplicate credit grant with the same reference", async () => {
    const account = await seedAccount();
    const grant = { accountId: account.id, delta: 10, reason: "purchase" as const, ref: "inv_123" };
    await db.insert(ledger).values(grant);

    await expect(db.insert(ledger).values(grant)).rejects.toThrow();

    const rows = await db.select().from(ledger);
    expect(rows).toHaveLength(1);
  });

  it("allows repeated sends, which carry no reference to dedupe on", async () => {
    const account = await seedAccount();
    await db.insert(ledger).values({ accountId: account.id, delta: -1, reason: "send", ref: "p-noura" });
    await db.insert(ledger).values({ accountId: account.id, delta: -1, reason: "send", ref: "p-layan" });

    expect(await db.select().from(ledger)).toHaveLength(2);
  });

  it("keeps the suppression list keyed by hash, not address", async () => {
    await db.insert(suppressions).values({ emailHash: "abc123", reason: "unsubscribed", source: "test" });
    const rows = await db.select().from(suppressions);
    expect(rows[0]).not.toHaveProperty("email");
    expect(rows[0].emailHash).toBe("abc123");
  });

  it("deduplicates people on LinkedIn URL", async () => {
    const person = {
      latin: "NOURA A.", firstAr: "نورة", title: "t", company: "c", geo: "الرياض",
      seniority: "director", linkedinUrl: "linkedin.com/in/noura", source: "seed" as const,
    };
    await db.insert(people).values(person);
    await expect(db.insert(people).values(person)).rejects.toThrow();
  });
});
