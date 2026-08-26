import { beforeEach, describe, expect, it } from "vitest";
import { reset, testDb } from "../db/testing";
import { scoped } from "../db/scoped";
import {
  accounts, authUsers, ledger, outreach, people, pipelineItems, pipelines, requests, sendAttempts,
} from "../db/schema";
import type { Database } from "../db";

/**
 * These tests ARE the security model. RLS cannot run under the neon-http
 * driver, so nothing but lib/db/scoped.ts stands between one account and
 * another's data — if these pass for the wrong reason, the product leaks.
 */
describe("cross-account isolation", () => {
  let db: Database;
  let a: string;
  let b: string;
  let aRequest: string;
  let aPipeline: string;

  async function makeAccount(email: string, name: string) {
    const [user] = await db.insert(authUsers).values({ email }).returning();
    const [account] = await db
      .insert(accounts)
      .values({ userId: user.id, displayName: name, initial: name[0], email, state: "verified" })
      .returning();
    return account.id;
  }

  beforeEach(async () => {
    db = await testDb();
    await reset(db);

    a = await makeAccount("a@x.sa", "أحمد");
    b = await makeAccount("b@x.sa", "بدر");

    const [person] = await db
      .insert(people)
      .values({
        latin: "NOURA A.", firstAr: "نورة", title: "t", company: "c", geo: "الرياض",
        seniority: "director", email: "noura@example.sa", emailVerified: true, source: "seed",
      })
      .returning();

    const [req] = await db
      .insert(requests)
      .values({
        accountId: a, requesterName: "أحمد", requesterInitial: "A", rawText: "سري",
        status: "pipeline_ready", assignedAm: "ريم",
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .returning();
    aRequest = req.id;

    const [pipeline] = await db
      .insert(pipelines)
      .values({ requestId: aRequest, version: 1, source: "ai_generated", status: "published", createdBy: "AI" })
      .returning();
    aPipeline = pipeline.id;

    await db.insert(pipelineItems).values({
      pipelineId: aPipeline, personId: person.id, rank: 1, fit: "strong", why: "w", whyNow: "n",
      roleRelevance: "عالية", companyRelevance: "عالية", timing: "عالية", leadWith: "l",
      avoid: "v", opener: "o", channel: "email", status: "approved", generatedBy: "ai",
    });

    await db.insert(outreach).values({
      requestId: aRequest, personId: person.id, channel: "email", status: "sent",
    });

    await db.insert(sendAttempts).values({
      accountId: a, requestId: aRequest, personId: person.id, pool: "user_mailbox",
      channel: "email", body: "سري", variantHash: "h", result: "allowed",
    });

    await db.insert(ledger).values({ accountId: a, delta: 10, reason: "purchase", ref: "inv_a" });
  });

  it("does not list another account's requests", async () => {
    expect(await scoped(db, a).requests()).toHaveLength(1);
    expect(await scoped(db, b).requests()).toHaveLength(0);
  });

  it("does not return another account's request by id", async () => {
    expect(await scoped(db, a).request(aRequest)).toBeDefined();
    expect(await scoped(db, b).request(aRequest)).toBeUndefined();
  });

  it("does not return pipelines under another account's request", async () => {
    expect(await scoped(db, a).pipelines(aRequest)).toHaveLength(1);
    expect(await scoped(db, b).pipelines(aRequest)).toHaveLength(0);
  });

  it("does not return pipeline items reached via a known pipeline id", async () => {
    expect(await scoped(db, a).pipelineItems(aPipeline)).toHaveLength(1);
    expect(await scoped(db, b).pipelineItems(aPipeline)).toHaveLength(0);
  });

  it("does not leak outreach, which is keyed by request rather than account", async () => {
    expect(await scoped(db, a).outreach()).toHaveLength(1);
    expect(await scoped(db, b).outreach()).toHaveLength(0);
  });

  it("does not leak send attempts, which carry the message body", async () => {
    expect(await scoped(db, a).sendAttempts()).toHaveLength(1);
    expect(await scoped(db, b).sendAttempts()).toHaveLength(0);
  });

  it("does not leak the ledger", async () => {
    expect(await scoped(db, a).ledger()).toHaveLength(1);
    expect(await scoped(db, b).ledger()).toHaveLength(0);
  });

  it("reports ownership honestly", async () => {
    expect(await scoped(db, a).owns(aRequest)).toBe(true);
    expect(await scoped(db, b).owns(aRequest)).toBe(false);
  });

  it("returns nothing rather than everything when an account owns no requests", async () => {
    // Guards the inArray([]) footgun: an empty id list must not widen the query.
    expect(await scoped(db, b).outreach()).toEqual([]);
  });
});
