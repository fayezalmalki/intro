import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { reset, testDb } from "../db/testing";
import * as repo from "../db/repo";
import { loadRequestContext } from "../db/loaders";
import { balanceOf } from "../credits";
import { hashEmail } from "../suppression";
import {
  accounts, authUsers, auditEvents, ledger, outreach, people,
  pipelineItems, pipelines, requests, sendAttempts, suppressions,
} from "../db/schema";
import type { Database } from "../db";
import type { Brief } from "../types";

const BRIEF: Brief = {
  goalType: "job", targetRoles: ["مدير منتج فأعلى"], seniority: ["قيادي"],
  industries: ["تقنية"], geos: ["السعودية"], inclusions: [], exclusions: [],
  summaryAr: "بركز على قادة المنتج.", confidence: 0.6, extractedBy: "rules",
};

describe("repository writes", () => {
  let db: Database;
  let accountId: string;
  let personId: string;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);

    const [user] = await db.insert(authUsers).values({ email: "f@x.sa" }).returning();
    const [account] = await db.insert(accounts).values({
      userId: user.id, displayName: "فيصل", initial: "F", email: "f@x.sa", state: "verified",
    }).returning();
    accountId = account.id;

    // The id is deliberate, not incidental: lib/sourcing.ts keys its sourced
    // evidence off these stable ids, so a generated UUID would leave every
    // AI-drafted row with no evidence and therefore unapprovable.
    const [person] = await db.insert(people).values({
      id: "p-noura", latin: "NOURA A.", firstAr: "نورة", title: "مديرة المنتج", company: "منصة مدفوعات",
      geo: "الرياض", industries: ["تقنية"], seniority: "director",
      email: "noura@example.sa", emailVerified: true, openToIntros: true, source: "seed",
    }).returning();
    personId = person.id;
  });

  const newRequest = () =>
    repo.createRequest(
      { accountId, rawText: "أدور وظيفة قيادية.", brief: BRIEF, slaHours: 24, assignedAm: "ريم" },
      db,
    );

  it("creates a request with an audit trail", async () => {
    const id = await newRequest();
    const [row] = await db.select().from(requests).where(eq(requests.id, id));
    expect(row.status).toBe("intent_review");
    expect(await db.select().from(auditEvents)).toHaveLength(1);
  });

  it("confirms a brief and drafts a pipeline in one transaction", async () => {
    const id = await newRequest();
    await repo.confirmBrief(id, "بركز على قادة المنتج في التقنية.", db);

    const [row] = await db.select().from(requests).where(eq(requests.id, id));
    expect(row.status).toBe("in_sourcing");
    expect((row.brief as Brief).summaryAr).toContain("التقنية");
    expect(await db.select().from(pipelines)).toHaveLength(1);
  });

  it("refuses to approve a row with no sourced evidence", async () => {
    const id = await newRequest();
    await repo.confirmBrief(id, undefined, db);
    const [pipeline] = await db.select().from(pipelines);
    const [item] = await db.insert(pipelineItems).values({
      pipelineId: pipeline.id, personId, rank: 99, fit: "possible", why: "w", whyNow: "n",
      roleRelevance: "—", companyRelevance: "—", timing: "—", leadWith: "l", avoid: "v",
      opener: "o", channel: "email", status: "proposed", generatedBy: "ai", evidence: [],
    }).returning();

    await repo.setItemStatus(pipeline.id, item.id, "approved", "ريم", db);
    const [after] = await db.select().from(pipelineItems).where(eq(pipelineItems.id, item.id));
    expect(after.status).toBe("proposed");
  });

  it("publishes only approved rows and drops the rest", async () => {
    const id = await newRequest();
    await repo.confirmBrief(id, undefined, db);
    const [pipeline] = await db.select().from(pipelines);
    const items = await db.select().from(pipelineItems);
    const withEvidence = items.filter((i) => (i.evidence ?? []).length > 0);
    expect(withEvidence.length).toBeGreaterThan(0);

    for (const item of withEvidence) {
      await repo.setItemStatus(pipeline.id, item.id, "approved", "ريم", db);
    }
    const requestId = await repo.publishPipeline(pipeline.id, "ريم", db);
    expect(requestId).toBe(id);

    const remaining = await db.select().from(pipelineItems);
    expect(remaining).toHaveLength(withEvidence.length);
    expect(remaining.every((i) => i.status === "approved")).toBe(true);
  });

  it("refuses to publish when nothing was approved", async () => {
    const id = await newRequest();
    await repo.confirmBrief(id, undefined, db);
    const [pipeline] = await db.select().from(pipelines);
    expect(await repo.publishPipeline(pipeline.id, "ريم", db)).toBeNull();
    // Nothing was dropped by the attempt.
    expect((await db.select().from(pipelineItems)).length).toBeGreaterThan(0);
  });

  it("supersedes the previous version when a new one is published", async () => {
    const id = await newRequest();
    await repo.confirmBrief(id, undefined, db);
    const [first] = await db.select().from(pipelines);
    for (const item of (await db.select().from(pipelineItems)).filter((i) => (i.evidence ?? []).length)) {
      await repo.setItemStatus(first.id, item.id, "approved", "ريم", db);
    }
    await repo.publishPipeline(first.id, "ريم", db);

    await repo.attachPipeline({
      requestId: id, source: "pasted", actor: "ريم",
      rows: [{ latin: "LAYAN M.", title: "رئيسة المنتج", company: "تأمين رقمي", email: "layan@example.sa" }],
    }, db);
    const second = (await db.select().from(pipelines)).find((p) => p.version === 2)!;
    await repo.publishPipeline(second.id, "ريم", db);

    const all = await db.select().from(pipelines);
    expect(all.filter((p) => p.status === "published")).toHaveLength(1);
    expect(all.find((p) => p.version === 1)!.status).toBe("superseded");
  });

  it("dedupes an attached person against the existing graph", async () => {
    const id = await newRequest();
    await repo.attachPipeline({
      requestId: id, source: "pasted", actor: "ريم",
      rows: [{ latin: "NOURA A.", title: "x", company: "y", email: "noura@example.sa" }],
    }, db);
    expect(await db.select().from(people)).toHaveLength(1);
  });

  describe("the money path", () => {
    let requestId: string;

    beforeEach(async () => {
      requestId = await newRequest();
      await db.insert(ledger).values({ accountId, delta: 5, reason: "grant", ref: "seed" });
      const [pipeline] = await db.insert(pipelines).values({
        requestId, version: 1, source: "ai_generated", status: "published", createdBy: "AI",
        publishedAt: new Date().toISOString(),
      }).returning();
      await db.insert(pipelineItems).values({
        pipelineId: pipeline.id, personId, rank: 1, fit: "strong", why: "w", whyNow: "n",
        roleRelevance: "عالية", companyRelevance: "عالية", timing: "عالية",
        leadWith: "l", avoid: "v", opener: "o", channel: "email",
        status: "approved", generatedBy: "ai",
        evidence: [{ url: "u", title: "t", source: "s", date: "d", assertedBy: "ai" }],
      });
    });

    const send = (body: string) =>
      repo.recordSend(
        { accountId, requestId, personId, channel: "email", body, actor: "فيصل" }, db,
      );

    it("debits exactly one credit and records the outreach", async () => {
      const before = balanceOf(await loadRequestContext(requestId, db), accountId);
      expect(await send("رسالة تخص نورة تحديدًا وتذكر توسع الفريق.")).toEqual({ ok: true });
      const after = balanceOf(await loadRequestContext(requestId, db), accountId);
      expect(after).toBe(before - 1);
      expect(await db.select().from(outreach)).toHaveLength(1);
    });

    it("does not charge for a refused send", async () => {
      await db.insert(suppressions).values({
        emailHash: hashEmail("noura@example.sa"), reason: "unsubscribed", source: "test",
      });
      const before = balanceOf(await loadRequestContext(requestId, db), accountId);
      const result = await send("رسالة تخص نورة تحديدًا وتذكر توسع الفريق.");

      expect(result.ok).toBe(false);
      expect(balanceOf(await loadRequestContext(requestId, db), accountId)).toBe(before);
      expect(await db.select().from(outreach)).toHaveLength(0);
      // The refusal is still on the record.
      const attempts = await db.select().from(sendAttempts);
      expect(attempts).toHaveLength(1);
      expect(attempts[0].result).toBe("refused");
    });

    /**
     * The reason recordSend locks the account row. Without FOR UPDATE both
     * sends read a balance of one and both spend it.
     */
    it("lets only one of two concurrent sends spend the last credit", async () => {
      await db.delete(ledger);
      await db.insert(ledger).values({ accountId, delta: 1, reason: "grant", ref: "one" });

      const [second] = await db.insert(people).values({
        latin: "LAYAN M.", firstAr: "ليان", title: "رئيسة المنتج", company: "تأمين رقمي",
        geo: "الرياض", industries: ["تقنية"], seniority: "head",
        email: "layan@example.sa", emailVerified: true, openToIntros: true, source: "seed",
      }).returning();
      const [pipeline] = await db.select().from(pipelines);
      await db.insert(pipelineItems).values({
        pipelineId: pipeline.id, personId: second.id, rank: 2, fit: "strong",
        why: "w", whyNow: "n", roleRelevance: "عالية", companyRelevance: "عالية",
        timing: "عالية", leadWith: "l", avoid: "v", opener: "o", channel: "email",
        status: "approved", generatedBy: "ai",
        evidence: [{ url: "u", title: "t", source: "s", date: "d", assertedBy: "ai" }],
      });

      const results = await Promise.all([
        send("رسالة أولى تخص نورة وتذكر توسع فريق المنتج بعد الجولة."),
        repo.recordSend({
          accountId, requestId, personId: second.id, channel: "email", actor: "فيصل",
          body: "رسالة ثانية مختلفة تمامًا تخص ليان ودورها القادم في التأمين.",
        }, db),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok)).toHaveLength(1);
      expect(balanceOf(await loadRequestContext(requestId, db), accountId)).toBe(0);
    });

    it("makes a repeated dev grant a no-op rather than free credits", async () => {
      await repo.verifyAndGrant(accountId, 5, db);
      await repo.verifyAndGrant(accountId, 5, db);
      const grants = (await db.select().from(ledger)).filter((e) => e.reason === "grant" && e.ref === "dev-grant");
      expect(grants).toHaveLength(1);
    });
  });
});
