import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { reset, testDb } from "../db/testing";
import * as repo from "../db/repo";
import { accounts, auditEvents, authUsers, creditOrders, leads } from "../db/schema";
import type { Database } from "../db";

describe("settings and the person's own data", () => {
  let db: Database;
  let accountId: string;
  let userId: string;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    const [u] = await db.insert(authUsers).values({ email: "noura@lumen.sa", name: "x" }).returning();
    userId = u.id;
    const [a] = await db.insert(accounts).values({ userId: u.id, displayName: "Noura", initial: "N", email: "noura@lumen.sa", locale: "ar" }).returning();
    accountId = a.id;
    await repo.createManualLeads(accountId, [{ name: "Reem", company: "Qimma", note: "Met at LEAP" }], "manual", db);
  });

  it("defaults emails on, and saves profile and preferences", async () => {
    let [a] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    expect(a.notifyResults && a.notifyReminders).toBe(true);
    await repo.updateProfile(accountId, { displayName: "Noura S", locale: "en", notifyReminders: false }, db);
    [a] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    expect(a).toMatchObject({ displayName: "Noura S", initial: "N", locale: "en", notifyResults: true, notifyReminders: false });
  });

  it("exports their leads, notes and profile", async () => {
    const data = await repo.exportAccountData(accountId, db);
    expect(data.account?.email).toBe("noura@lumen.sa");
    expect(data.leads[0]).toMatchObject({ name: "Reem", company: "Qimma", note: "Met at LEAP" });
    expect(data.activity.map((x) => x.kind).sort()).toEqual(["created", "note"]);
  });

  it("deletes everything, keeping paid orders as an audit record", async () => {
    await db.insert(creditOrders).values({ accountId, package: "starter", credits: 100, amountHalalas: 9900, status: "paid", invoiceId: "inv_1" });
    expect(await repo.deleteAccount(accountId, db)).toBe(true);
    expect(await db.select().from(accounts).where(eq(accounts.id, accountId))).toHaveLength(0);
    expect(await db.select().from(authUsers).where(eq(authUsers.id, userId))).toHaveLength(0);
    expect(await db.select().from(leads).where(eq(leads.accountId, accountId))).toHaveLength(0);
    const [rec] = await db.select().from(auditEvents).where(eq(auditEvents.action, "account.deleted"));
    expect(rec.detail).toContain("inv_1");
    expect(await repo.deleteAccount(accountId, db)).toBe(false);
  });
});
