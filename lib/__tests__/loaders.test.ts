import { beforeEach, describe, expect, it } from "vitest";
import { reset, testDb } from "../db/testing";
import { loadLists, loadQueue, loadRequestContext, merge } from "../db/loaders";
import { buildPipelineView } from "../pipeline";
import { canSend } from "../gate";
import {
  accounts, authUsers, ledger, listMembers, outreach, people, peopleLists,
  pipelineItems, pipelines, requests, sendAttempts, suppressions,
} from "../db/schema";
import type { Database } from "../db";

/**
 * The loaders exist to hand the pure functions the exact `Db` shape they
 * already consume. These tests check that by running the real gate and the
 * real pipeline view against loaded data, not by inspecting the rows.
 */
describe("loaders", () => {
  let db: Database;
  let accountId: string;
  let otherAccountId: string;
  let requestId: string;
  let personId: string;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);

    const mkAccount = async (email: string, name: string) => {
      const [u] = await db.insert(authUsers).values({ email }).returning();
      const [a] = await db
        .insert(accounts)
        .values({ userId: u.id, displayName: name, initial: name[0], email, state: "verified" })
        .returning();
      return a.id;
    };
    accountId = await mkAccount("a@x.sa", "أحمد");
    otherAccountId = await mkAccount("b@x.sa", "بدر");

    const [p] = await db.insert(people).values({
      latin: "NOURA A.", firstAr: "نورة", title: "مديرة المنتج", company: "منصة مدفوعات",
      geo: "الرياض", seniority: "director", email: "noura@example.sa",
      emailVerified: true, openToIntros: true, source: "seed",
    }).returning();
    personId = p.id;

    const [r] = await db.insert(requests).values({
      accountId, requesterName: "أحمد", requesterInitial: "A",
      rawText: "أدور وظيفة قيادية في الـ Product.", status: "pipeline_ready",
      assignedAm: "ريم", dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      brief: {
        goalType: "job", targetRoles: ["مدير منتج فأعلى"], seniority: ["قيادي"],
        industries: ["تقنية"], geos: ["السعودية"], inclusions: [], exclusions: [],
        summaryAr: "بركز على قادة المنتج.", confidence: 0.6, extractedBy: "rules",
      },
      confirmedAt: new Date().toISOString(),
    }).returning();
    requestId = r.id;

    const [pl] = await db.insert(pipelines).values({
      requestId, version: 1, source: "ai_generated", status: "published",
      createdBy: "AI", publishedAt: new Date().toISOString(),
    }).returning();

    await db.insert(pipelineItems).values({
      pipelineId: pl.id, personId, rank: 1, fit: "strong", why: "w", whyNow: "n",
      roleRelevance: "عالية", companyRelevance: "عالية", timing: "عالية",
      leadWith: "l", avoid: "v", opener: "o", channel: "email",
      status: "approved", generatedBy: "ai",
      evidence: [{ url: "u", title: "t", source: "s", date: "d", assertedBy: "ai" }],
    });

    await db.insert(ledger).values({ accountId, delta: 5, reason: "grant", ref: "seed" });
  });

  it("hands the pipeline view everything it needs", async () => {
    const ctx = await loadRequestContext(requestId, db);
    const view = buildPipelineView(ctx, requestId)!;
    expect(view.stages.find((s) => s.key === "publish")!.state).toBe("done");
    expect(view.stages.find((s) => s.key === "intent")!.summary).toBe("بركز على قادة المنتج.");
  });

  it("hands the send gate everything it needs to allow a send", async () => {
    const ctx = await loadRequestContext(requestId, db);
    const verdict = canSend(ctx, {
      accountId, requestId, personId, channel: "email", body: "رسالة تخص هذا الشخص تحديدًا.",
    });
    expect(verdict.allowed).toBe(true);
  });

  it("loads the global suppression list, so the gate can refuse", async () => {
    const { hashEmail } = await import("../suppression");
    await db.insert(suppressions).values({
      emailHash: hashEmail("noura@example.sa"), reason: "unsubscribed", source: "test",
    });
    const ctx = await loadRequestContext(requestId, db);
    const verdict = canSend(ctx, {
      accountId, requestId, personId, channel: "email", body: "رسالة أخرى مختلفة تمامًا.",
    });
    expect(verdict.failures).toContain("recipient_suppressed");
  });

  it("carries outreach and send attempts into the context", async () => {
    await db.insert(outreach).values({ requestId, personId, channel: "email", status: "sent" });
    await db.insert(sendAttempts).values({
      accountId, requestId, personId, pool: "user_mailbox", channel: "email",
      body: "b", variantHash: "h", result: "allowed",
    });
    const ctx = await loadRequestContext(requestId, db);
    expect(ctx.outreach).toHaveLength(1);
    expect(ctx.sendAttempts).toHaveLength(1);
  });

  it("returns an empty context for an unknown request", async () => {
    const ctx = await loadRequestContext("nope", db);
    expect(ctx.requests).toHaveLength(0);
    expect(buildPipelineView(ctx, "nope")).toBeUndefined();
  });

  it("does not leak another account's pipelines into the context", async () => {
    // The request row itself is reachable by id, but everything scoped to the
    // owning account must not be — scoped() derives ownership from the request.
    const [foreign] = await db.insert(requests).values({
      accountId: otherAccountId, requesterName: "بدر", requesterInitial: "B",
      rawText: "سري", status: "pipeline_ready", assignedAm: "ريم",
      dueAt: new Date().toISOString(),
    }).returning();
    await db.insert(pipelines).values({
      requestId: foreign.id, version: 1, source: "ai_generated", status: "published",
      createdBy: "AI",
    });

    const mine = await loadRequestContext(requestId, db);
    expect(mine.pipelines.every((p) => p.requestId === requestId)).toBe(true);
    expect(mine.ledger.every((e) => e.accountId === accountId)).toBe(true);
  });

  it("loads the queue with every request and its versions", async () => {
    const queue = await loadQueue(db);
    expect(queue.requests).toHaveLength(1);
    expect(queue.pipelines).toHaveLength(1);
  });

  it("loads lists with their members", async () => {
    const [list] = await db.insert(peopleLists).values({
      name: "قادة المنتج", description: "مدير منتج وأعلى.",
    }).returning();
    await db.insert(listMembers).values({ listId: list.id, personId });

    const lists = await loadLists(db);
    expect(lists.lists[0].personIds).toEqual([personId]);
    expect(lists.people).toHaveLength(1);
  });

  it("merges loaders into one Db for a page that needs both", async () => {
    const combined = merge(await loadRequestContext(requestId, db), await loadLists(db));
    expect(combined.requests).toHaveLength(1);
    expect(combined.lists).toHaveLength(0);
  });

  it("converts absent columns to undefined rather than null", async () => {
    const ctx = await loadRequestContext(requestId, db);
    // `note` is unset on this pipeline; the domain types say undefined.
    expect(ctx.pipelines[0].note).toBeUndefined();
    expect(ctx.people[0].linkedinUrl).toBeUndefined();
  });
});
