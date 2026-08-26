import { describe, expect, it } from "vitest";
import { buildPipelineView } from "../pipeline";
import { emptyDb } from "../seed";
import type { Db } from "../types";

/**
 * The pipeline view is derived, never stored — so these tests are really
 * checking that each stage reports the truth about state living elsewhere.
 */
function seeded(over: (db: Db) => void = () => {}): Db {
  const db = emptyDb();
  db.requests.push({
    id: "r1",
    accountId: "acc-faisal",
    requesterName: "فيصل",
    requesterInitial: "F",
    rawText: "أدور وظيفة قيادية في الـ Product.",
    status: "in_sourcing",
    brief: {
      goalType: "job",
      targetRoles: ["مدير منتج فأعلى"],
      seniority: ["قيادي"],
      industries: ["تقنية"],
      geos: ["السعودية"],
      inclusions: [],
      exclusions: ["أدوار غير قيادية"],
      summaryAr: "بركز على قادة المنتج.",
      confidence: 0.6,
      extractedBy: "rules",
    },
    confirmedAt: new Date().toISOString(),
    assignedAm: "ريم",
    createdAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  over(db);
  return db;
}

const item = (over: Record<string, unknown> = {}) => ({
  id: "i1", personId: "p-noura", rank: 1, fit: "strong" as const, thin: false,
  why: "w", whyNow: "n", roleRelevance: "عالية", companyRelevance: "عالية",
  timing: "عالية", leadWith: "l", avoid: "v", opener: "o",
  channel: "email" as const, status: "proposed" as const,
  evidence: [{ url: "u", title: "t", source: "s", date: "d", assertedBy: "ai" as const }],
  generatedBy: "ai" as const, ...over,
});

describe("pipeline view", () => {
  it("shows Arabic labels rather than leaking enum keys", () => {
    const db = seeded((d) => {
      d.pipelines.push({
        id: "pl1", requestId: "r1", version: 1, source: "from_list", status: "draft",
        createdBy: "ريم", createdAt: new Date().toISOString(), items: [item()],
      });
    });
    const view = buildPipelineView(db, "r1")!;
    const goal = view.stages.find((s) => s.key === "intent")!.details.find((d) => d.label === "الهدف")!;
    const source = view.stages.find((s) => s.key === "review")!.details.find((d) => d.label === "المصدر")!;
    expect(goal.value).toBe("وظيفة");
    expect(source.value).toBe("من قائمة جاهزة");
  });

  it("returns nothing for an unknown request", () => {
    expect(buildPipelineView(emptyDb(), "nope")).toBeUndefined();
  });

  it("walks every stage of the journey in order", () => {
    const view = buildPipelineView(seeded(), "r1")!;
    expect(view.stages.map((s) => s.key)).toEqual([
      "intake", "intent", "sourcing", "review", "publish", "outreach", "replies",
    ]);
  });

  it("marks sourcing active while no pipeline exists", () => {
    const view = buildPipelineView(seeded(), "r1")!;
    expect(view.stages.find((s) => s.key === "sourcing")!.state).toBe("active");
    expect(view.stages.find((s) => s.key === "publish")!.state).toBe("pending");
  });

  it("blocks review when a row has no sourced evidence", () => {
    const db = seeded((d) => {
      d.pipelines.push({
        id: "pl1", requestId: "r1", version: 1, source: "ai_generated", status: "draft",
        createdBy: "AI", createdAt: new Date().toISOString(),
        items: [item(), item({ id: "i2", personId: "p-salman", evidence: [] })],
      });
    });
    const review = buildPipelineView(db, "r1")!.stages.find((s) => s.key === "review")!;
    expect(review.state).toBe("blocked");
    expect(review.details.find((d) => d.label === "بدون مصدر موثّق")!.tone).toBe("bad");
  });

  it("reports review active once every row is backed by evidence", () => {
    const db = seeded((d) => {
      d.pipelines.push({
        id: "pl1", requestId: "r1", version: 1, source: "ai_generated", status: "draft",
        createdBy: "AI", createdAt: new Date().toISOString(), items: [item()],
      });
    });
    expect(buildPipelineView(db, "r1")!.stages.find((s) => s.key === "review")!.state).toBe("active");
  });

  it("lists every version once one is published", () => {
    const db = seeded((d) => {
      d.pipelines.push(
        { id: "pl1", requestId: "r1", version: 1, source: "ai_generated", status: "superseded",
          createdBy: "AI", createdAt: new Date().toISOString(), items: [] },
        { id: "pl2", requestId: "r1", version: 2, source: "from_list", status: "published",
          createdBy: "ريم", createdAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(), items: [item({ status: "approved" })] },
      );
    });
    const publish = buildPipelineView(db, "r1")!.stages.find((s) => s.key === "publish")!;
    expect(publish.state).toBe("done");
    expect(publish.details).toHaveLength(2);
  });

  it("surfaces gate refusals rather than hiding them", () => {
    const db = seeded((d) => {
      d.sendAttempts.push({
        id: "sa1", accountId: "acc-faisal", requestId: "r1", personId: "p-noura",
        pool: "user_mailbox", channel: "email", body: "b", variantHash: "h",
        result: "refused", gateFailures: ["recipient_suppressed", "near_duplicate"],
        at: new Date().toISOString(),
      });
      d.outreach.push({
        requestId: "r1", personId: "p-layan", channel: "intro", status: "sent",
        updatedAt: new Date().toISOString(),
      });
    });
    const outreach = buildPipelineView(db, "r1")!.stages.find((s) => s.key === "outreach")!;
    const refusals = outreach.details.find((x) => x.label === "رفض البوابة")!;
    expect(refusals.value).toContain("recipient_suppressed");
    expect(refusals.tone).toBe("warn");
  });

  it("flags an overdue request against its SLA", () => {
    const db = seeded((d) => {
      d.requests[0].dueAt = new Date(Date.now() - 3600_000).toISOString();
    });
    const sourcing = buildPipelineView(db, "r1")!.stages.find((s) => s.key === "sourcing")!;
    expect(sourcing.details.find((x) => x.label === "الموعد")!.tone).toBe("bad");
  });

  it("points at the stage the request is actually sitting in", () => {
    const view = buildPipelineView(seeded(), "r1")!;
    expect(view.stages[view.currentIndex].key).toBe("sourcing");
  });
});
