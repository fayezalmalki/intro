import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The webhook route, against the real database.
 *
 * The route's own job is narrow — read the body once, check the signature
 * before anything else, and never make a provider retry something that will
 * never succeed — so that is what is asserted here. The settlement logic below
 * it has its own suite in lib/payments/__tests__.
 */

vi.mock("@/lib/db", async () => {
  const { testDb } = await import("@/lib/db/testing");
  const db = await testDb();
  return { db, resolveDb: () => db, schema: await import("@/lib/db/schema") };
});

const post = async (body: string, signature: string | null) => {
  const { POST } = await import("../route");
  return POST(
    new Request("http://localhost/api/webhooks/streampay", {
      method: "POST",
      headers: signature ? { "x-streampay-signature": signature } : {},
      body,
    }),
  );
};

describe("POST /api/webhooks/streampay", () => {
  let db: Awaited<ReturnType<typeof import("@/lib/db/testing").testDb>>;
  let accountId: string;
  let providerRef: string;
  let amountHalalas: number;

  beforeEach(async () => {
    const { reset, testDb } = await import("@/lib/db/testing");
    const { accounts, authUsers, checkouts } = await import("@/lib/db/schema");
    db = await testDb();
    await reset(db);

    const [user] = await db
      .insert(authUsers)
      .values({ id: "u1", email: "f@intro.sa" })
      .returning();
    const [account] = await db
      .insert(accounts)
      .values({ userId: user.id, displayName: "فايز", initial: "F", email: "f@intro.sa" })
      .returning();
    accountId = account.id;

    const [checkout] = await db
      .insert(checkouts)
      .values({
        accountId,
        provider: "test",
        providerRef: "test_ref_1",
        product: "intro",
        credits: 50,
        amountHalalas: 49_500,
      })
      .returning();
    providerRef = checkout.providerRef;
    amountHalalas = checkout.amountHalalas;
  });

  function paidBody(eventId = "evt_1") {
    return JSON.stringify({
      id: eventId,
      type: "checkout.paid",
      data: {
        id: providerRef,
        amount: amountHalalas,
        status: "paid",
        metadata: { product: "intro" },
      },
    });
  }

  async function balance() {
    const { ledger } = await import("@/lib/db/schema");
    const rows = await db.select().from(ledger);
    return rows.reduce((sum, r) => sum + r.delta, 0);
  }

  /**
   * The credential. Without this check the endpoint is "anyone on the internet
   * may grant themselves credits".
   */
  it("refuses an unsigned body", async () => {
    const response = await post(paidBody(), null);
    expect(response.status).toBe(401);
    expect(await balance()).toBe(0);
  });

  it("refuses a wrong signature, including a wrong-length one", async () => {
    expect((await post(paidBody(), "deadbeef")).status).toBe(401);
    // timingSafeEqual throws on a length mismatch; a 500 here would be a bug.
    expect((await post(paidBody(), "ab")).status).toBe(401);
    expect(await balance()).toBe(0);
  });

  /**
   * The signature is over bytes. Signing a re-serialized object would let a
   * forged payload pass whenever the round trip happens to be stable.
   */
  it("verifies the signature against the raw body, not a re-serialized one", async () => {
    const { signTestPayload } = await import("@/lib/payments/provider");
    const body = paidBody();
    const reordered = JSON.stringify({ ...JSON.parse(body), extra: 1 });
    expect((await post(reordered, signTestPayload(body))).status).toBe(401);
  });

  it("settles a signed payment once and grants its credits", async () => {
    const { signTestPayload } = await import("@/lib/payments/provider");
    const body = paidBody();
    const response = await post(body, signTestPayload(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, outcome: "granted" });
    expect(await balance()).toBe(50);
  });

  it("acknowledges a retry without granting again", async () => {
    const { signTestPayload } = await import("@/lib/payments/provider");
    const body = paidBody();
    await post(body, signTestPayload(body));
    const second = await post(body, signTestPayload(body));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, outcome: "duplicate" });
    expect(await balance()).toBe(50);
  });

  /**
   * A verified event we cannot act on is still a 200. A 500 would have the
   * provider retry a payload that can never succeed, forever.
   */
  it("acknowledges a verified event it does not model", async () => {
    const { signTestPayload } = await import("@/lib/payments/provider");
    const body = JSON.stringify({ id: "evt_x", type: "checkout.pending", data: { id: providerRef } });
    const response = await post(body, signTestPayload(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: true });
    expect(await balance()).toBe(0);
  });

  it("rejects a signed body that is not JSON", async () => {
    const { signTestPayload } = await import("@/lib/payments/provider");
    const body = "not json";
    expect((await post(body, signTestPayload(body))).status).toBe(400);
  });
});
