import { beforeEach, describe, expect, it, vi } from "vitest";
import { reset, testDb } from "../db/testing";
import { accounts, authUsers, pipelines, requests } from "../db/schema";
import { loadMyRequests } from "../db/loaders";
import type { Database } from "../db";
import type { Account, Role } from "../types";

/**
 * Who may read and write a request.
 *
 * /requests/[id] used to call currentAccount() — which proves someone is
 * signed in and nothing more — and then render whatever request the URL named:
 * another person's brief, the whole pipeline of names, titles and companies,
 * and a send button spending the *viewer's* credits. confirmBrief had the same
 * hole from the other direction, since a server action is a POST endpoint that
 * never needs the page.
 *
 * The signed-in user is stubbed; the policy under test is the real one.
 */
let signedIn = "";

vi.mock("../auth", () => ({
  auth: async () => (signedIn ? { user: { email: signedIn } } : null),
}));

describe("request access", () => {
  let db: Database;
  const id: Record<string, string> = {};

  const mkAccount = async (email: string, role: Role) => {
    const [u] = await db.insert(authUsers).values({ email }).returning();
    const [a] = await db
      .insert(accounts)
      .values({
        userId: u.id, role, displayName: email.split("@")[0],
        initial: email[0].toUpperCase(), email, state: "verified",
      })
      .returning();
    return a;
  };

  const mkRequest = async (accountId: string, rawText: string) => {
    const [r] = await db.insert(requests).values({
      accountId, requesterName: "x", requesterInitial: "X", rawText,
      status: "in_sourcing", dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    }).returning();
    return r.id;
  };

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    vi.unstubAllEnvs();

    const owner = await mkAccount("owner@x.sa", "requester");
    const stranger = await mkAccount("stranger@x.sa", "requester");
    const am = await mkAccount("reem@intro.sa", "account_manager");
    id.owner = owner.id;
    id.stranger = stranger.id;
    id.am = am.id;
    id.request = await mkRequest(owner.id, "أدور وظيفة قيادية في الـ Product.");
    id.strangerRequest = await mkRequest(stranger.id, "أبي أوصل لمسؤول الشراكات.");
  });

  const as = (accountId: string, role: Role): Account => ({
    id: accountId, userId: "u", role, displayName: "x", initial: "X",
    email: "x@x.sa", state: "verified", dailyCap: 10,
    createdAt: "2026-08-01T00:00:00.000Z",
  });

  describe("canReadRequest", () => {
    it("lets the owner read their own request", async () => {
      const { canReadRequest } = await import("../session");
      expect(canReadRequest(as(id.owner, "requester"), id.owner)).toBe(true);
    });

    it("refuses another requester who has the id", async () => {
      const { canReadRequest } = await import("../session");
      expect(canReadRequest(as(id.stranger, "requester"), id.owner)).toBe(false);
    });

    /**
     * Deliberate. An account manager can already read the same request at
     * /am/requests/[id], so refusing them here would protect nothing and would
     * break their own path through the app.
     */
    it("lets an account manager read someone else's request", async () => {
      const { canReadRequest } = await import("../session");
      expect(canReadRequest(as(id.am, "account_manager"), id.owner)).toBe(true);
      expect(canReadRequest(as(id.am, "admin"), id.owner)).toBe(true);
    });
  });

  describe("requireRequestOwner", () => {
    it("returns the account when it owns the request", async () => {
      signedIn = "owner@x.sa";
      const { requireRequestOwner } = await import("../session");
      const account = await requireRequestOwner(id.request, "confirm this request", db);
      expect(account.id).toBe(id.owner);
    });

    it("refuses another requester", async () => {
      signedIn = "stranger@x.sa";
      const { requireRequestOwner } = await import("../session");
      await expect(requireRequestOwner(id.request, "confirm this request", db))
        .rejects.toThrow(/not permitted/i);
    });

    /**
     * Stricter than reading, and not role-based: recordSend charges the caller
     * for a send against the request it names, so an account manager acting
     * here would attach one account's ledger rows to another's request.
     */
    it("refuses an account manager who does not own the request", async () => {
      signedIn = "reem@intro.sa";
      const { requireRequestOwner } = await import("../session");
      await expect(requireRequestOwner(id.request, "send on this request", db))
        .rejects.toThrow(/not permitted/i);
    });

    /** A missing request refuses the same way, so the error reports nothing. */
    it("refuses a request that does not exist", async () => {
      signedIn = "owner@x.sa";
      const { requireRequestOwner } = await import("../session");
      await expect(requireRequestOwner("00000000-0000-0000-0000-000000000000", "x", db))
        .rejects.toThrow(/not permitted/i);
    });
  });

  describe("loadMyRequests", () => {
    it("returns the account's own requests and nobody else's", async () => {
      const mine = await loadMyRequests(id.owner, db);
      expect(mine.requests.map((r) => r.id)).toEqual([id.request]);
    });

    it("is empty for an account with no requests", async () => {
      const none = await loadMyRequests(id.am, db);
      expect(none.requests).toEqual([]);
      expect(none.pipelines).toEqual([]);
    });

    /** The list shows a published version, so the pipelines must come with it. */
    it("brings the pipelines behind those requests, and only those", async () => {
      await db.insert(pipelines).values({
        requestId: id.request, version: 1, source: "ai_generated", status: "published",
        createdBy: "ريم",
      });
      await db.insert(pipelines).values({
        requestId: id.strangerRequest, version: 1, source: "ai_generated", status: "published",
        createdBy: "ريم",
      });

      const mine = await loadMyRequests(id.owner, db);
      expect(mine.pipelines).toHaveLength(1);
      expect(mine.pipelines[0].requestId).toBe(id.request);
    });
  });
});
