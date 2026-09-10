import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { reset, testDb } from "../../db/testing";
import { radarBaselines, radarCompanies, radarRuns, radarSignals, usageEvents } from "../../db/schema";
import type { Database } from "../../db";
import type { Coresignal } from "../../coresignal";
import { seatQueryHash, seedCompanies, sweep } from "../sweep";

/**
 * A stand-in Coresignal that costs nothing and answers from a script, so the
 * sweep's behaviour over a sequence of weeks is testable without a key.
 * `paidCalls` stays at zero in every test here — that is the claim being made
 * about this file: detection never buys anything.
 */
function fakeClient(weeks: number[][], opts: { total?: number | null; companyId?: number | null } = {}) {
  let week = 0;
  const state = { paidCalls: 0, searches: 0 };
  const client = {
    async searchCompanies() {
      state.searches += 1;
      const id = opts.companyId === undefined ? 500 : opts.companyId;
      return { ids: id === null ? [] : [id], total: id === null ? 0 : 1, creditsRemaining: 1000 };
    },
    async searchEmployeesEsDsl() {
      const ids = weeks[Math.min(week, weeks.length - 1)];
      week += 1;
      state.searches += 1;
      return { ids, total: opts.total === undefined ? ids.length : opts.total, creditsRemaining: 1000 };
    },
    async collectEmployee() { state.paidCalls += 1; throw new Error("detection must not buy"); },
    async collectCompany() { state.paidCalls += 1; throw new Error("detection must not buy"); },
    async enrichCompanyByWebsite() { state.paidCalls += 1; throw new Error("detection must not buy"); },
    async creditsRemaining() { return 1000; },
  } as unknown as Coresignal;
  return { client, state };
}

describe("radar sweep", () => {
  let db: Database;
  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    await seedCompanies(db, { banking: [{ name: "Al Rajhi Bank", website: "alrajhibank.com.sa" }] });
  });

  const signals = () => db.select().from(radarSignals);

  it("seeds idempotently", async () => {
    const again = await seedCompanies(db, {
      banking: [{ name: "Al Rajhi Bank", website: "alrajhibank.com.sa" }],
    });
    expect(again).toBe(0);
    expect(await db.select().from(radarCompanies)).toHaveLength(1);
  });

  it("spends nothing and reports nothing on the first sweep", async () => {
    const { client, state } = fakeClient([[1, 2, 3]]);
    const result = await sweep(db, client);
    expect(state.paidCalls).toBe(0);
    expect(result.signalsDetected).toBe(0);
    expect(result.skips).toEqual([{ company: "Al Rajhi Bank", reason: "first_run" }]);
    const [baseline] = await db.select().from(radarBaselines);
    expect(baseline.employeeIds).toEqual([1, 2, 3]);
  });

  it("detects an arrival and a departure on the second sweep, still free", async () => {
    const { client, state } = fakeClient([[1, 2, 3], [2, 3, 4]]);
    await sweep(db, client);
    const result = await sweep(db, client);
    expect(state.paidCalls).toBe(0);
    expect(result.signalsDetected).toBe(2);
    const rows = await signals();
    expect(rows.map((r) => [r.coresignalEmployeeId, r.kind]).sort()).toEqual([[1, "departure"], [4, "arrival"]]);
    // Detected rows carry no name and no spend — that is the whole design.
    expect(rows.every((r) => r.personName === null && r.creditsSpent === 0)).toBe(true);
  });

  it("is idempotent: re-running the same week files nothing twice", async () => {
    const { client } = fakeClient([[1, 2, 3], [2, 3, 4], [2, 3, 4]]);
    await sweep(db, client);
    await sweep(db, client);
    const after = await sweep(db, client);
    expect(after.signalsDetected).toBe(0);
    expect(await signals()).toHaveLength(2);
  });

  it("records a run row for every sweep, with its skips", async () => {
    const { client } = fakeClient([[1, 2, 3]]);
    await sweep(db, client);
    const [run] = await db.select().from(radarRuns);
    expect(run.status).toBe("ok");
    expect(run.companiesChecked).toBe(1);
    expect(run.skips).toEqual([{ company: "Al Rajhi Bank", reason: "first_run" }]);
    expect(run.finishedAt).not.toBeNull();
  });

  /**
   * The failure that kills scheduled work is the silent one. A throwing sweep
   * must leave a failed row and a usage event behind, so a dead cron and a
   * quiet week do not look the same on the ops page.
   */
  it("leaves a failed run row and a usage event when it throws", async () => {
    const broken = {
      async searchCompanies() { throw new Error("401 from provider"); },
    } as unknown as Coresignal;
    await expect(sweep(db, broken)).rejects.toThrow("401 from provider");
    const [run] = await db.select().from(radarRuns);
    expect(run.status).toBe("failed");
    expect(run.error).toContain("401");
    expect(run.finishedAt).not.toBeNull();
    const events = await db.select().from(usageEvents).where(eq(usageEvents.kind, "radar_run_failed"));
    expect(events).toHaveLength(1);
  });

  it("skips a company whose website resolves to nothing, without failing the sweep", async () => {
    const { client } = fakeClient([[1]], { companyId: null });
    const result = await sweep(db, client);
    expect(result.skips).toEqual([{ company: "Al Rajhi Bank", reason: "unresolved_company" }]);
    expect(result.companiesChecked).toBe(0);
    const [run] = await db.select().from(radarRuns);
    expect(run.status).toBe("ok");
  });

  it("resolves the vendor id once and remembers it", async () => {
    const { client, state } = fakeClient([[1], [1]]);
    await sweep(db, client);
    const searchesAfterFirst = state.searches;
    await sweep(db, client);
    // Second sweep does one search (employees), not two (company + employees).
    expect(state.searches - searchesAfterFirst).toBe(1);
    const [company] = await db.select().from(radarCompanies);
    expect(company.coresignalId).toBe(500);
  });

  it("refuses to diff a truncated result and keeps the baseline", async () => {
    const { client } = fakeClient([[1, 2, 3], [1]], { total: 99 });
    await sweep(db, client);
    const result = await sweep(db, client);
    expect(result.signalsDetected).toBe(0);
    expect(result.skips.at(-1)?.reason).toBe("truncated");
    const [baseline] = await db.select().from(radarBaselines);
    expect(baseline.employeeIds).toEqual([1, 2, 3]);
  });

  /**
   * A baseline only means something against the question it answered. If the
   * title list moves, the stored ids answered a different question and must be
   * abandoned rather than diffed.
   */
  it("starts a fresh baseline when the query changes", async () => {
    const { client } = fakeClient([[1, 2, 3], [9]]);
    await sweep(db, client);
    await db.update(radarBaselines).set({ queryHash: "a-different-question" });
    const result = await sweep(db, client);
    expect(result.signalsDetected).toBe(0);
    expect(result.skips.at(-1)?.reason).toBe("first_run");
    const [baseline] = await db.select().from(radarBaselines);
    expect(baseline.employeeIds).toEqual([9]);
    expect(baseline.queryHash).toBe(seatQueryHash(500));
  });
});
