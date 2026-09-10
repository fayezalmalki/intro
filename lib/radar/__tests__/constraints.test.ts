import { beforeEach, describe, expect, it } from "vitest";
import { reset, testDb } from "../../db/testing";
import { radarCompanies, radarIssues, radarSignals, radarSubscribers } from "../../db/schema";
import type { Database } from "../../db";

/**
 * The evidence gate, and the opt-in rule, are CHECK constraints rather than
 * conventions. These tests exist to prove the database refuses the write —
 * not that some code path happens to avoid making it. A rule enforced only in
 * application code is a rule that survives until the second code path.
 */
/**
 * Drizzle wraps the driver error, so the constraint name lives on the cause
 * chain rather than the message. Asserting on the name — instead of a bare
 * `.rejects.toThrow()` — is the difference between proving *this* rule fired
 * and proving merely that something went wrong.
 */
async function expectViolation(work: Promise<unknown>, constraint: string) {
  let caught: unknown;
  await work.catch((err) => { caught = err; });
  expect(caught, `expected a constraint violation for ${constraint}`).toBeDefined();
  const chain: string[] = [];
  for (let e = caught as { message?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    if (e.message) chain.push(e.message);
  }
  expect(chain.join(" | ")).toContain(constraint);
}

describe("radar constraints", () => {
  let db: Database;
  beforeEach(async () => {
    db = await testDb();
    await reset(db);
  });

  const company = async () => {
    const [row] = await db
      .insert(radarCompanies)
      .values({ clusterSlug: "banking", name: "Al Rajhi Bank", website: "alrajhibank.com.sa" })
      .returning();
    return row;
  };

  const evidence = [{
    url: "https://example.sa/a", title: "تعيين", source: "coresignal",
    date: "2026-09-01", assertedBy: "ai" as const,
  }];

  it("lets a detected signal exist as nothing but a vendor id", async () => {
    const c = await company();
    const [row] = await db.insert(radarSignals).values({
      clusterSlug: "banking", companyId: c.id, coresignalEmployeeId: 1, kind: "arrival",
    }).returning();
    expect(row.status).toBe("detected");
    expect(row.personName).toBeNull();
    expect(row.evidence).toEqual([]);
    expect(row.creditsSpent).toBe(0);
  });

  it("refuses to approve a signal with no name", async () => {
    const c = await company();
    await expectViolation(db.insert(radarSignals).values({
      clusterSlug: "banking", companyId: c.id, coresignalEmployeeId: 2, kind: "arrival",
      status: "approved", evidence,
    }), "radar_signals_approved_needs_name");
  });

  it("refuses to approve a signal with no evidence", async () => {
    const c = await company();
    await expectViolation(db.insert(radarSignals).values({
      clusterSlug: "banking", companyId: c.id, coresignalEmployeeId: 3, kind: "arrival",
      status: "approved", personName: "فلان",
    }), "radar_signals_approved_needs_evidence");
  });

  it("refuses to publish a signal that lost its evidence", async () => {
    const c = await company();
    await expectViolation(db.insert(radarSignals).values({
      clusterSlug: "banking", companyId: c.id, coresignalEmployeeId: 4, kind: "departure",
      status: "published", personName: "فلان", evidence: [],
    }), "radar_signals_approved_needs_evidence");
  });

  it("accepts an approved signal carrying both", async () => {
    const c = await company();
    const [row] = await db.insert(radarSignals).values({
      clusterSlug: "banking", companyId: c.id, coresignalEmployeeId: 5, kind: "arrival",
      status: "approved", personName: "فلان", personTitle: "Head of Digital", evidence,
      creditsSpent: 20,
    }).returning();
    expect(row.status).toBe("approved");
    expect(row.creditsSpent).toBe(20);
  });

  /** A re-run of the sweep must not file the same change twice. */
  it("files a given change once per company", async () => {
    const c = await company();
    const values = {
      clusterSlug: "banking", companyId: c.id, coresignalEmployeeId: 6, kind: "arrival" as const,
    };
    await db.insert(radarSignals).values(values);
    await expect(db.insert(radarSignals).values(values)).rejects.toThrow();
  });

  it("still allows the same person to arrive and later depart", async () => {
    const c = await company();
    await db.insert(radarSignals).values({
      clusterSlug: "banking", companyId: c.id, coresignalEmployeeId: 7, kind: "arrival",
    });
    const [row] = await db.insert(radarSignals).values({
      clusterSlug: "banking", companyId: c.id, coresignalEmployeeId: 7, kind: "departure",
    }).returning();
    expect(row.kind).toBe("departure");
  });

  it("refuses a confirmed subscriber with no confirmation date", async () => {
    await expectViolation(db.insert(radarSubscribers).values({
      email: "a@b.sa", token: "t1", status: "confirmed",
    }), "radar_subscribers_confirmed_needs_date");
  });

  it("accepts a pending subscriber, which is the only way in", async () => {
    const [row] = await db.insert(radarSubscribers)
      .values({ email: "a@b.sa", token: "t2", clusters: ["banking"] }).returning();
    expect(row.status).toBe("pending");
    expect(row.confirmedAt).toBeNull();
  });

  it("holds one row per address", async () => {
    await db.insert(radarSubscribers).values({ email: "dup@b.sa", token: "t3" });
    await expect(
      db.insert(radarSubscribers).values({ email: "dup@b.sa", token: "t4" }),
    ).rejects.toThrow();
  });

  it("refuses a published issue with no publication date", async () => {
    await expectViolation(db.insert(radarIssues).values({
      clusterSlug: "banking", number: 1, status: "published",
    }), "radar_issues_published_needs_date");
  });

  it("holds one issue number per cluster", async () => {
    await db.insert(radarIssues).values({ clusterSlug: "banking", number: 1 });
    await expect(
      db.insert(radarIssues).values({ clusterSlug: "banking", number: 1 }),
    ).rejects.toThrow();
    // ...but the same number in another cluster is a different briefing.
    const [row] = await db.insert(radarIssues)
      .values({ clusterSlug: "insurance", number: 1 }).returning();
    expect(row.number).toBe(1);
  });
});
