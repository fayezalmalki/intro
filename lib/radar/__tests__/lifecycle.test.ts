import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { reset, testDb } from "../../db/testing";
import { radarCompanies, radarSignals, radarSubscribers } from "../../db/schema";
import type { Database } from "../../db";
import type { Coresignal } from "../../coresignal";
import { EmptyIssueError, issueByNumber, latestIssue, publishIssue, publishedIssues } from "../issues";
import { RESOLVE_COST, removeSignal, resolveSignal } from "../resolve";
import { confirm, recipientsFor, subscribe, unsubscribe } from "../subscribers";

function collector(record: Record<string, unknown> | null, spent = RESOLVE_COST) {
  const state = { calls: 0 };
  const api = {
    async collectEmployee() {
      state.calls += 1;
      return { data: record, cached: false, creditsSpent: spent, creditsRemaining: 900 };
    },
  } as unknown as Coresignal;
  return { api, state };
}

const PERSON = {
  id: 42, full_name: "Noura Al-Otaibi",
  active_experience_title: "Head of Digital Partnerships",
  active_experience_company_name: "Al Rajhi Bank",
  linkedin_url: "https://linkedin.com/in/example",
};

describe("radar lifecycle", () => {
  let db: Database;
  beforeEach(async () => { db = await testDb(); await reset(db); });

  async function detected() {
    const [company] = await db.insert(radarCompanies)
      .values({ clusterSlug: "banking", name: "Al Rajhi Bank", website: "alrajhibank.com.sa" })
      .returning();
    const [signal] = await db.insert(radarSignals).values({
      clusterSlug: "banking", companyId: company.id, coresignalEmployeeId: 42, kind: "arrival",
    }).returning();
    return signal;
  }

  describe("resolve", () => {
    it("buys a name only on approval, and records what it cost", async () => {
      const signal = await detected();
      const { api, state } = collector(PERSON);
      const out = await resolveSignal(db, signal.id, api);
      expect(out).toEqual({ status: "resolved", creditsSpent: RESOLVE_COST });
      expect(state.calls).toBe(1);
      const [row] = await db.select().from(radarSignals).where(eq(radarSignals.id, signal.id));
      expect(row.status).toBe("approved");
      expect(row.personName).toBe("Noura Al-Otaibi");
      expect(row.personTitle).toBe("Head of Digital Partnerships");
      expect(row.creditsSpent).toBe(RESOLVE_COST);
      expect(row.evidence).toHaveLength(1);
      expect(row.evidence[0].source).toBe("coresignal");
      expect(row.evidence[0].assertedBy).toBe("ai");
    });

    it("does not buy the same name twice", async () => {
      const signal = await detected();
      const { api, state } = collector(PERSON);
      await resolveSignal(db, signal.id, api);
      const again = await resolveSignal(db, signal.id, api);
      expect(again).toEqual({ status: "already_resolved", creditsSpent: 0 });
      expect(state.calls).toBe(1);
    });

    /**
     * A paid call that comes back without a name leaves the row where it was.
     * An approved row with a placeholder where a person should be is exactly
     * the claim this product cannot afford to publish.
     */
    it("leaves the row detected when the vendor has no name", async () => {
      const signal = await detected();
      const { api } = collector({ id: 42, full_name: null, first_name: null, last_name: null });
      const out = await resolveSignal(db, signal.id, api);
      expect(out.status).toBe("not_found");
      const [row] = await db.select().from(radarSignals).where(eq(radarSignals.id, signal.id));
      expect(row.status).toBe("detected");
      expect(row.personName).toBeNull();
    });

    it("removing a change costs nothing and never bought a name", async () => {
      const signal = await detected();
      await removeSignal(db, signal.id);
      const [row] = await db.select().from(radarSignals).where(eq(radarSignals.id, signal.id));
      expect(row.status).toBe("removed");
      expect(row.creditsSpent).toBe(0);
    });
  });

  describe("issues", () => {
    it("publishes approved items and marks them published", async () => {
      const signal = await detected();
      const { api } = collector(PERSON);
      await resolveSignal(db, signal.id, api);

      const issue = await publishIssue(db, "banking");
      expect(issue.number).toBe(1);
      expect(issue.publishedAt).not.toBeNull();

      const found = await latestIssue(db, "banking");
      expect(found?.items).toHaveLength(1);
      expect(found?.items[0].status).toBe("published");
      expect(found?.items[0].issueId).toBe(issue.id);
    });

    it("refuses to publish an empty issue", async () => {
      await expect(publishIssue(db, "banking")).rejects.toBeInstanceOf(EmptyIssueError);
      expect(await publishedIssues(db, "banking")).toHaveLength(0);
    });

    it("does not re-publish an already published item in the next issue", async () => {
      const first = await detected();
      const { api } = collector(PERSON);
      await resolveSignal(db, first.id, api);
      await publishIssue(db, "banking");
      // Nothing approved is left, so there is nothing to publish.
      await expect(publishIssue(db, "banking")).rejects.toBeInstanceOf(EmptyIssueError);
    });

    it("numbers issues per cluster and finds one by its number", async () => {
      const signal = await detected();
      const { api } = collector(PERSON);
      await resolveSignal(db, signal.id, api);
      const issue = await publishIssue(db, "banking");
      expect(await issueByNumber(db, "banking", issue.number)).not.toBeNull();
      expect(await issueByNumber(db, "insurance", issue.number)).toBeNull();
    });
  });

  describe("subscribers", () => {
    it("starts pending and hands back a token to mail", async () => {
      const out = await subscribe(db, "  Reader@Example.SA ", ["banking"]);
      expect(out.status).toBe("pending");
      const [row] = await db.select().from(radarSubscribers);
      expect(row.email).toBe("reader@example.sa");
      expect(row.status).toBe("pending");
      expect(row.confirmedAt).toBeNull();
    });

    it("a pending address is not a recipient", async () => {
      await subscribe(db, "reader@example.sa", ["banking"]);
      expect(await recipientsFor(db, "banking")).toHaveLength(0);
    });

    it("only the token confirms, and then it is a recipient", async () => {
      const out = await subscribe(db, "reader@example.sa", ["banking"]);
      if (out.status !== "pending") throw new Error("expected pending");
      expect(await confirm(db, "not-the-token")).toBe(false);
      expect(await confirm(db, out.token)).toBe(true);
      expect(await recipientsFor(db, "banking")).toHaveLength(1);
    });

    it("drops unknown clusters instead of storing them", async () => {
      await subscribe(db, "reader@example.sa", ["banking", "not-a-cluster"]);
      const [row] = await db.select().from(radarSubscribers);
      expect(row.clusters).toEqual(["banking"]);
    });

    /**
     * Someone typing a colleague's address into the form must not be able to
     * re-send mail to an address that already confirmed, nor knock it back to
     * pending.
     */
    it("re-subscribing a confirmed address sends nothing and keeps it confirmed", async () => {
      const first = await subscribe(db, "reader@example.sa", ["banking"]);
      if (first.status !== "pending") throw new Error("expected pending");
      await confirm(db, first.token);
      const again = await subscribe(db, "reader@example.sa", ["insurance"]);
      expect(again).toEqual({ status: "already_confirmed" });
      const [row] = await db.select().from(radarSubscribers);
      expect(row.status).toBe("confirmed");
      expect(row.clusters).toEqual(["insurance"]);
    });

    it("unsubscribes on the token alone, and stops being a recipient", async () => {
      const out = await subscribe(db, "reader@example.sa", ["banking"]);
      if (out.status !== "pending") throw new Error("expected pending");
      await confirm(db, out.token);
      expect(await unsubscribe(db, out.token)).toBe(true);
      expect(await recipientsFor(db, "banking")).toHaveLength(0);
    });

    it("an unsubscribed address cannot be re-confirmed with the old token", async () => {
      const out = await subscribe(db, "reader@example.sa", ["banking"]);
      if (out.status !== "pending") throw new Error("expected pending");
      await confirm(db, out.token);
      await unsubscribe(db, out.token);
      expect(await confirm(db, out.token)).toBe(false);
    });

    it("treats an empty cluster list as every cluster", async () => {
      const out = await subscribe(db, "reader@example.sa", []);
      if (out.status !== "pending") throw new Error("expected pending");
      await confirm(db, out.token);
      expect(await recipientsFor(db, "energy")).toHaveLength(1);
    });
  });
});
