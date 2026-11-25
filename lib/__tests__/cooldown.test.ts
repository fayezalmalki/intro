import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { reset, testDb } from "../db/testing";
import * as repo from "../db/repo";
import { accounts, authUsers, ledger, people, pipelines, sendAttempts } from "../db/schema";
import type { Database } from "../db";
import type { Brief } from "../types";

const BRIEF: Brief = {
  goalType: "job", targetRoles: ["مدير منتج"], seniority: ["قيادي"],
  industries: ["تقنية"], geos: ["السعودية"], inclusions: [], exclusions: [],
  summaryAr: "قادة المنتج.", confidence: 0.6, extractedBy: "rules",
};

/**
 * The 90-day cross-requester cooldown: one person is contacted by at most one
 * Intro account per 90 days. Before the D1 move the loader only fetched the
 * sending account's own attempts, so another account's recent send was
 * invisible to the gate and this rule never fired.
 */
describe("cross-account cooldown", () => {
  let db: Database;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
  });

  async function accountWithRequest(email: string) {
    const [user] = await db.insert(authUsers).values({ email, name: email }).returning();
    const [account] = await db.insert(accounts).values({
      userId: user.id, displayName: email, initial: "X", email, state: "verified",
    }).returning();
    await db.insert(ledger).values({ accountId: account.id, delta: 5, reason: "grant", ref: "g" });
    const requestId = await repo.createRequest(
      { accountId: account.id, rawText: "x", brief: BRIEF, slaHours: 24 }, db,
    );
    // The same person, attached by email, so both requests name one people row.
    await repo.attachPipeline({
      requestId, source: "pasted", actor: "am",
      rows: [{ latin: "Noura A.", title: "Head of Product", company: "Pay", email: "noura@pay.sa" }],
    }, db);
    const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.requestId, requestId));
    await repo.publishPipeline(pipeline.id, "am", db);
    const [person] = await db.select({ id: people.id }).from(people).where(eq(people.email, "noura@pay.sa"));
    return { accountId: account.id, requestId, personId: person.id };
  }

  it("refuses a second account contacting the same person within 90 days", async () => {
    const a = await accountWithRequest("a@x.sa");
    const b = await accountWithRequest("b@x.sa");
    expect(a.personId).toBe(b.personId);

    const first = await repo.recordSend({
      accountId: a.accountId, requestId: a.requestId, personId: a.personId,
      channel: "email", actor: "a", body: "رسالة من الحساب الأول عن توسع فريق المنتج.",
    }, db);
    expect(first.ok).toBe(true);

    const second = await repo.recordSend({
      accountId: b.accountId, requestId: b.requestId, personId: b.personId,
      channel: "email", actor: "b", body: "رسالة مختلفة تمامًا من الحساب الثاني عن فرصة شراكة.",
    }, db);
    expect(second.ok).toBe(false);

    const [refused] = await db.select().from(sendAttempts)
      .where(eq(sendAttempts.accountId, b.accountId));
    expect(refused.gateFailures).toContain("recipient_cooldown");
  });

  it("does not leak another account's message text into the gate's context", async () => {
    const a = await accountWithRequest("a@x.sa");
    const b = await accountWithRequest("b@x.sa");
    await repo.recordSend({
      accountId: a.accountId, requestId: a.requestId, personId: a.personId,
      channel: "email", actor: "a", body: "نص سري من الحساب الأول",
    }, db);

    const { loadRequestContext } = await import("../db/loaders");
    const ctx = await loadRequestContext(b.requestId, db);
    const foreign = ctx.sendAttempts.filter((s) => s.accountId === a.accountId);
    expect(foreign).toHaveLength(1);
    expect(foreign[0].body).toBe("");
  });
});
