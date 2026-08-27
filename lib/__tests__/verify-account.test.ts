import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { reset, testDb } from "../db/testing";
import { accounts, auditEvents, authUsers, ledger } from "../db/schema";
import * as repo from "../db/repo";
import { canSend } from "../gate";
import type { Database } from "../db";
import type { Db } from "../types";

/**
 * Verification is what makes sending reachable at all.
 *
 * Every account is provisioned as an observer with an empty ledger, so the
 * gate refuses every send with account_not_verified and insufficient_credits.
 * These run against a real transaction rather than a mock, because the
 * idempotency this depends on is an index in Postgres, not a branch in
 * TypeScript — a stub would happily agree with a wrong implementation.
 */
describe("verifyAndCredit", () => {
  let db: Database;
  let target: string;

  const makeAccount = async (name: string) => {
    const [user] = await db.insert(authUsers).values({ email: `${name}@example.sa` }).returning();
    const [account] = await db.insert(accounts).values({
      userId: user.id, role: "requester", displayName: name,
      initial: name[0].toUpperCase(), email: `${name}@example.sa`, state: "observer",
    }).returning();
    return account.id;
  };

  const stateOf = async (id: string) =>
    (await db.select().from(accounts).where(eq(accounts.id, id)).limit(1))[0];

  const balance = async (id: string) =>
    (await db.select().from(ledger).where(eq(ledger.accountId, id)))
      .reduce((sum, row) => sum + row.delta, 0);

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    target = await makeAccount("noura");
  });

  it("turns an observer into a verified account with credits", async () => {
    const result = await repo.verifyAndCredit(
      { accountId: target, amount: 10, ref: "admin-verify:10", actor: "root" }, db,
    );

    expect(result).toEqual({ ok: true, granted: true });
    const account = await stateOf(target);
    expect(account.state).toBe("verified");
    expect(account.verifiedAt).toBeTruthy();
    expect(await balance(target)).toBe(10);
  });

  /** A double-submitted form must not double the credits. */
  it("absorbs a replay of the same ref", async () => {
    const ref = "admin-verify:10";
    await repo.verifyAndCredit({ accountId: target, amount: 10, ref, actor: "root" }, db);
    const second = await repo.verifyAndCredit({ accountId: target, amount: 10, ref, actor: "root" }, db);

    expect(second).toEqual({ ok: true, granted: false });
    expect(await balance(target)).toBe(10);
  });

  /**
   * The reason this exists rather than un-gating verifyAndGrant, whose ref is
   * hardcoded: with a fixed ref an account could be credited exactly once and
   * never topped up again.
   */
  it("tops up under a different ref", async () => {
    await repo.verifyAndCredit({ accountId: target, amount: 10, ref: "a", actor: "root" }, db);
    const second = await repo.verifyAndCredit({ accountId: target, amount: 10, ref: "b", actor: "root" }, db);

    expect(second).toEqual({ ok: true, granted: true });
    expect(await balance(target)).toBe(20);
  });

  it("refuses an account that does not exist", async () => {
    const result = await repo.verifyAndCredit(
      { accountId: "00000000-0000-0000-0000-000000000000", amount: 10, ref: "a", actor: "root" }, db,
    );
    expect(result).toEqual({ ok: false, reason: "unknown_account" });
    expect(await db.select().from(ledger)).toHaveLength(0);
  });

  /** The granting admin, not the literal "dev" that verifyAndGrant records. */
  it("records who granted it", async () => {
    await repo.verifyAndCredit({ accountId: target, amount: 10, ref: "a", actor: "فيصل" }, db);
    const events = await db.select().from(auditEvents).where(eq(auditEvents.entity, target));
    expect(events).toHaveLength(1);
    expect(events[0].actor).toBe("فيصل");
    expect(events[0].action).toBe("account.verified");
  });

  /**
   * The point of the whole change: the two failures that made sending
   * unreachable in production are both gone afterwards.
   */
  it("clears the two gate failures that blocked every send", async () => {
    const gateDb = async (): Promise<Db> => {
      const [account] = await db.select().from(accounts).where(eq(accounts.id, target)).limit(1);
      return {
        accounts: [{ ...account, verifiedAt: account.verifiedAt ?? undefined,
          frozenAt: account.frozenAt ?? undefined, frozenReason: account.frozenReason ?? undefined,
          assignedAm: account.assignedAm ?? undefined }] as Db["accounts"],
        people: [{
          id: "p1", latin: "NOURA A.", firstAr: "نورة", title: "مديرة المنتج",
          company: "منصة", geo: "الرياض", seniority: "director", email: "n@example.sa",
          emailVerified: true, openToIntros: true, source: "seed",
        }] as unknown as Db["people"],
        requests: [], pipelines: [], outreach: [], lists: [],
        ledger: (await db.select().from(ledger).where(eq(ledger.accountId, target)))
          .map((r) => ({ ...r, ref: r.ref ?? undefined })) as Db["ledger"],
        suppressions: [], sendAttempts: [], audit: [],
      };
    };
    const send = { accountId: target, requestId: "r1", personId: "p1", channel: "intro" as const, body: "سلام" };

    const before = canSend(await gateDb(), send).failures;
    expect(before).toContain("account_not_verified");
    expect(before).toContain("insufficient_credits");

    await repo.verifyAndCredit({ accountId: target, amount: 10, ref: "a", actor: "root" }, db);

    const after = canSend(await gateDb(), send).failures;
    expect(after).not.toContain("account_not_verified");
    expect(after).not.toContain("insufficient_credits");
  });
});

describe("creditStanding", () => {
  let db: Database;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
  });

  it("sums each account's ledger and omits accounts with none", async () => {
    const make = async (name: string) => {
      const [user] = await db.insert(authUsers).values({ email: `${name}@example.sa` }).returning();
      const [a] = await db.insert(accounts).values({
        userId: user.id, role: "requester", displayName: name, initial: "X",
        email: `${name}@example.sa`, state: "observer",
      }).returning();
      return a.id;
    };
    const one = await make("one");
    const two = await make("two");
    const none = await make("none");

    await db.insert(ledger).values([
      { accountId: one, delta: 10, reason: "grant", ref: "a" },
      { accountId: one, delta: -3, reason: "send", ref: "s1" },
      { accountId: two, delta: 5, reason: "grant", ref: "a" },
    ]);

    const result = await repo.creditStanding(db);
    expect(result.get(one)?.balance).toBe(7);
    expect(result.get(two)?.balance).toBe(5);
    expect(result.has(none)).toBe(false);
  });

  /**
   * The count the page turns into the next grant's ref. It must count grants
   * only — a send is not a grant, and counting it would skip a ref and, worse,
   * could repeat one after a refund.
   */
  it("counts grant rows, not every ledger row", async () => {
    const [user] = await db.insert(authUsers).values({ email: "g@example.sa" }).returning();
    const [a] = await db.insert(accounts).values({
      userId: user.id, role: "requester", displayName: "g", initial: "G",
      email: "g@example.sa", state: "verified",
    }).returning();
    await db.insert(ledger).values([
      { accountId: a.id, delta: 10, reason: "grant", ref: "admin-grant:0" },
      { accountId: a.id, delta: -1, reason: "send", ref: "s1" },
      { accountId: a.id, delta: -1, reason: "send", ref: "s2" },
      { accountId: a.id, delta: 10, reason: "grant", ref: "admin-grant:1" },
    ]);

    const standing = (await repo.creditStanding(db)).get(a.id);
    expect(standing).toEqual({ balance: 18, grants: 2 });
  });
});
