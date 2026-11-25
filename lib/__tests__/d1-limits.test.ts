import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { reset, testDb } from "../db/testing";
import * as repo from "../db/repo";
import { accounts, authUsers, people, pipelineItems, pipelines } from "../db/schema";
import { SEED_PEOPLE } from "../seed";
import type { Database } from "../db";
import type { Brief } from "../types";

const BRIEF: Brief = {
  goalType: "job", targetRoles: ["مدير منتج فأعلى"], seniority: ["قيادي"],
  industries: ["تقنية"], geos: ["السعودية"], inclusions: [], exclusions: [],
  summaryAr: "قادة المنتج.", confidence: 0.6, extractedBy: "rules",
};

/**
 * D1 caps bound parameters at 100 per statement. A pipeline row has 19
 * columns, so a multi-row insert of six drafted rows (114 parameters) fails
 * on D1 even though SQLite elsewhere accepts it. These run the real-size
 * paths against the real D1 engine.
 */
describe("D1 statement limits", () => {
  let db: Database;
  let accountId: string;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    for (const person of SEED_PEOPLE) await db.insert(people).values(person);
    const [user] = await db.insert(authUsers).values({ email: "f@x.sa", name: "f" }).returning();
    const [account] = await db.insert(accounts).values({
      userId: user.id, displayName: "فيصل", initial: "F", email: "f@x.sa",
    }).returning();
    accountId = account.id;
  });

  it("confirms a brief that drafts a full pipeline from the seeded graph", async () => {
    const requestId = await repo.createRequest(
      { accountId, rawText: "أدور وظيفة قيادية في المنتج.", brief: BRIEF, slaHours: 24 }, db,
    );
    await repo.confirmBrief(requestId, undefined, db);

    const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.requestId, requestId));
    const items = await db.select().from(pipelineItems).where(eq(pipelineItems.pipelineId, pipeline.id));
    expect(items.length).toBeGreaterThanOrEqual(6);
  });

  it("attaches a pasted list of many rows as one version", async () => {
    const requestId = await repo.createRequest(
      { accountId, rawText: "x", brief: BRIEF, slaHours: 24 }, db,
    );
    const rows = Array.from({ length: 30 }, (_, i) => ({
      latin: `Person ${i}`, title: "Head of Product", company: `Co ${i}`, email: `p${i}@co${i}.sa`,
    }));
    await repo.attachPipeline({ requestId, source: "pasted", rows, actor: "am" }, db);

    const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.requestId, requestId));
    const items = await db.select().from(pipelineItems).where(eq(pipelineItems.pipelineId, pipeline.id));
    expect(items).toHaveLength(30);
  });
});
