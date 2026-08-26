import { describe, expect, it } from "vitest";
import { canSend, poolFor, similarity, variantHash } from "../gate";
import { hashEmail, isSuppressed, suppress } from "../suppression";
import { balanceOf, entry, sentToday } from "../credits";
import type { SendAttempt } from "../types";
import { BODY, OTHER, db, send } from "./fixtures";

const attempt = (over: Partial<SendAttempt> = {}): SendAttempt => ({
  id: "s1",
  accountId: "a1",
  requestId: "r1",
  personId: "p1",
  pool: "user_mailbox",
  channel: "email",
  body: BODY,
  variantHash: variantHash(BODY),
  result: "allowed",
  gateFailures: [],
  at: new Date().toISOString(),
  ...over,
});

/** A prior send to someone else, long enough ago not to trip the cooldown. */
const elsewhere = (over: Partial<SendAttempt> = {}) =>
  attempt({ personId: "p2", requestId: "r9", at: "2020-01-01T00:00:00.000Z", ...over });

describe("suppression", () => {
  it("normalizes case and whitespace before hashing", () => {
    expect(hashEmail("  NOURA@Example.SA ")).toBe(hashEmail("noura@example.sa"));
  });

  it("refuses a suppressed recipient", () => {
    const d = db({ suppressions: [suppress("noura@example.sa", "unsubscribed", "test")] });
    expect(isSuppressed(d, "noura@example.sa")).toBe(true);
    const r = canSend(d, send());
    expect(r.allowed).toBe(false);
    expect(r.failures).toContain("recipient_suppressed");
  });

  it("cannot be bypassed by changing the casing of the address", () => {
    const d = db({ suppressions: [suppress("NOURA@EXAMPLE.SA", "complained", "test")] });
    expect(canSend(d, send()).failures).toContain("recipient_suppressed");
  });
});

describe("account state", () => {
  it("blocks an observer at the gate", () => {
    const d = db();
    d.accounts[0].state = "observer";
    expect(canSend(d, send()).failures).toContain("account_not_verified");
  });

  it("lets a verified account through", () => {
    expect(canSend(db(), send()).allowed).toBe(true);
  });

  it("blocks a frozen account", () => {
    const d = db();
    d.accounts[0].frozenAt = new Date().toISOString();
    expect(canSend(d, send()).failures).toContain("account_frozen");
  });
});

describe("caps and credits", () => {
  it("refuses once the daily cap is reached", () => {
    const d = db();
    d.accounts[0].dailyCap = 2;
    d.sendAttempts = [attempt({ id: "s1" }), attempt({ id: "s2", personId: "p2" })];
    const r = canSend(d, send({ personId: "p2", requestId: "r2", body: OTHER }));
    expect(r.failures).toContain("daily_cap_reached");
  });

  it("holds the cap even when the balance is large", () => {
    const d = db({ ledger: [{ id: "l1", accountId: "a1", delta: 500, reason: "purchase", at: "" }] });
    d.accounts[0].dailyCap = 1;
    d.sendAttempts = [attempt()];
    const r = canSend(d, send({ personId: "p2", requestId: "r2", body: OTHER }));
    expect(r.failures).toContain("daily_cap_reached");
    expect(r.failures).not.toContain("insufficient_credits");
  });

  it("refuses an empty balance", () => {
    expect(canSend(db({ ledger: [] }), send()).failures).toContain("insufficient_credits");
  });

  it("treats balance as the ledger sum, so a bounce refund restores it", () => {
    const d = db({
      ledger: [
        { id: "l1", accountId: "a1", delta: 3, reason: "purchase", at: "" },
        entry("a1", "send", "s1", "l2"),
        entry("a1", "refund_bounce", "s1", "l3"),
      ],
    });
    expect(balanceOf(d, "a1")).toBe(3);
  });

  it("returns a credit when an intro is accepted", () => {
    const d = db({ ledger: [entry("a1", "send", "s1", "l1"), entry("a1", "bonus_accept", "s1", "l2")] });
    expect(balanceOf(d, "a1")).toBe(0);
  });

  it("counts only today's allowed attempts against the cap", () => {
    const d = db({
      sendAttempts: [
        attempt({ id: "s1" }),
        attempt({ id: "s2", at: "2020-01-01T00:00:00.000Z" }),
        attempt({ id: "s3", result: "refused" }),
      ],
    });
    expect(sentToday(d, "a1")).toBe(1);
  });
});

describe("cooldown", () => {
  it("allows one message per person per request", () => {
    const d = db({
      outreach: [{ requestId: "r1", personId: "p1", channel: "email", status: "sent", updatedAt: "" }],
    });
    expect(canSend(d, send()).failures).toContain("already_contacted");
  });

  it("puts a person contacted from another request on cooldown", () => {
    const d = db({ sendAttempts: [attempt({ requestId: "r9" })] });
    expect(canSend(d, send({ body: OTHER })).failures).toContain("recipient_cooldown");
  });

  it("expires the cooldown after 90 days", () => {
    const old = new Date(Date.now() - 91 * 86_400_000).toISOString();
    const d = db({ sendAttempts: [attempt({ requestId: "r9", at: old })] });
    expect(canSend(d, send({ body: OTHER })).failures).not.toContain("recipient_cooldown");
  });
});

describe("near-duplicate detection", () => {
  it("refuses an identical body", () => {
    const d = db({ sendAttempts: [elsewhere()] });
    expect(canSend(d, send()).failures).toContain("near_duplicate");
  });

  it("refuses a body where only the name was swapped", () => {
    const d = db({ sendAttempts: [elsewhere()] });
    const renamed = BODY.replace("نورة", "طارق");
    expect(canSend(d, send({ body: renamed })).failures).toContain("near_duplicate");
  });

  it("allows a genuinely different body", () => {
    const d = db({ sendAttempts: [elsewhere()] });
    expect(canSend(d, send({ body: OTHER })).allowed).toBe(true);
  });

  it("scores identical text at 1 and unrelated text near 0", () => {
    expect(similarity(BODY, BODY)).toBe(1);
    expect(similarity(BODY, OTHER)).toBeLessThan(0.2);
  });
});

describe("channel and pool", () => {
  it("refuses the email route for a person with no address", () => {
    expect(canSend(db(), send({ personId: "p3" })).failures).toContain("no_channel");
  });

  it("allows the LinkedIn route without an address", () => {
    expect(canSend(db(), send({ personId: "p3", channel: "linkedin" })).allowed).toBe(true);
  });

  it("keeps intro requests and direct outreach on separate pools", () => {
    expect(poolFor("intro")).toBe("intro_request");
    expect(poolFor("email")).toBe("user_mailbox");
    expect(poolFor("linkedin")).toBe("user_mailbox");
  });
});

describe("reporting", () => {
  it("reports every failure, not only the first", () => {
    const d = db({ ledger: [], suppressions: [suppress("noura@example.sa", "bounced", "t")] });
    d.accounts[0].state = "observer";
    const r = canSend(d, send());
    expect(r.failures.length).toBeGreaterThanOrEqual(3);
    expect(r.reason).toBeTruthy();
  });
});
