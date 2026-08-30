import { beforeEach, describe, expect, it } from "vitest";
import { reset, testDb } from "../../db/testing";
import { accounts, authUsers, checkouts, ledger, webhookEvents } from "../../db/schema";
import { balanceOf } from "../../credits";
import { settleEvent, startCheckout } from "../checkout";
import { BUNDLES, bundleById, formatSar, HALALAS_PER_CREDIT, unitHalalas } from "../pricing";
import { PRODUCT, signTestPayload, testProvider, type ProviderEvent } from "../provider";
import type { Database } from "../../db";

/**
 * The payment path, with the emphasis on the half that costs money when it is
 * wrong: a provider retry must never grant twice, and an event belonging to
 * another app on the same provider account must never grant at all.
 */

const APP = "http://localhost:3000";

async function seedAccount(db: Database, id = "acc-1"): Promise<string> {
  const [user] = await db
    .insert(authUsers)
    .values({ id: `user-${id}`, email: `${id}@example.sa` })
    .returning();
  const [account] = await db
    .insert(accounts)
    .values({
      id,
      userId: user.id,
      displayName: "فايز",
      initial: "F",
      email: `${id}@example.sa`,
    })
    .returning();
  return account.id;
}

async function ledgerDb(db: Database, accountId: string) {
  const rows = await db.select().from(ledger);
  return balanceOf(
    {
      accounts: [], people: [], requests: [], pipelines: [], outreach: [], lists: [],
      suppressions: [], sendAttempts: [], audit: [],
      ledger: rows.map((r) => ({ ...r, ref: r.ref ?? undefined })),
    },
    accountId,
  );
}

describe("pricing", () => {
  /**
   * docs/03-design-review.md §5, as an invariant rather than a good intention:
   * never price so that blasting is cheaper per send.
   */
  it("charges the same per credit in every bundle", () => {
    for (const bundle of BUNDLES) expect(unitHalalas(bundle)).toBe(HALALAS_PER_CREDIT);
  });

  it("keeps money in integers", () => {
    for (const bundle of BUNDLES) expect(Number.isInteger(bundle.halalas)).toBe(true);
  });

  it("prints a price without floating point", () => {
    expect(formatSar(9900)).toBe("99 ر.س");
    expect(formatSar(49500)).toBe("495 ر.س");
    expect(formatSar(198000)).toBe("1,980 ر.س");
    // Halalas still print when there are any, so a future non-round price is
    // not silently rounded away.
    expect(formatSar(9950)).toBe("99.50 ر.س");
  });

  it("resolves a bundle by id and refuses an unknown one", () => {
    expect(bundleById("team")?.credits).toBe(50);
    expect(bundleById("free-money")).toBeUndefined();
  });
});

describe("the test provider", () => {
  const provider = testProvider(APP);

  it("is marked as a stand-in, so the UI can say so", () => {
    expect(provider.name).toBe("test");
    expect(provider.isTest).toBe(true);
  });

  it("verifies its own signature and rejects anything else", () => {
    const body = JSON.stringify({ id: "evt_1" });
    expect(provider.verify(body, signTestPayload(body))).toBe(true);
    expect(provider.verify(body, "deadbeef")).toBe(false);
    expect(provider.verify(body, null)).toBe(false);
    // A wrong-length signature must not throw — timingSafeEqual would.
    expect(provider.verify(body, "ab")).toBe(false);
  });

  it("refuses an event it cannot fully read", () => {
    expect(provider.parse({ type: "checkout.paid" })).toBeNull();
    expect(provider.parse({ id: "evt_1", data: { id: "ref_1" }, type: "checkout.pending" })).toBeNull();
    expect(provider.parse(null)).toBeNull();
  });
});

describe("settleEvent", () => {
  let db: Database;
  let accountId: string;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    accountId = await seedAccount(db);
  });

  async function started(credits = 50) {
    const bundle = BUNDLES.find((b) => b.credits === credits)!;
    return startCheckout(
      { accountId, bundle, returnUrl: `${APP}/gtm` },
      testProvider(APP),
      db,
    );
  }

  function paidEvent(ref: string, halalas: number, eventId = "evt_1"): ProviderEvent {
    return { eventId, providerRef: ref, status: "paid", halalas, product: PRODUCT };
  }

  it("creates a checkout the provider can be redirected to", async () => {
    const result = await started();
    expect(result.isTest).toBe(true);
    expect(result.redirectUrl).toContain("/gtm/pay/test");
    const [row] = await db.select().from(checkouts);
    expect(row.status).toBe("created");
    expect(row.providerRef.startsWith("test_")).toBe(true);
    expect(row.product).toBe(PRODUCT);
    // Nothing is granted at creation. The webhook is the only granting path.
    expect(await ledgerDb(db, accountId)).toBe(0);
  });

  it("grants credits once when the provider says paid", async () => {
    const checkout = await started(50);
    const [row] = await db.select().from(checkouts);

    const result = await settleEvent(paidEvent(row.providerRef, row.amountHalalas), "test", {}, db);
    expect(result).toEqual({ outcome: "granted", credits: 50 });
    expect(await ledgerDb(db, accountId)).toBe(50);

    const [after] = await db.select().from(checkouts);
    expect(after.status).toBe("paid");
    expect(after.settledAt).not.toBeNull();
    expect(checkout.checkoutId).toBe(after.id);
  });

  /** Every payment provider retries. This is the whole reason webhook_events exists. */
  it("grants nothing on a retry of the same event", async () => {
    await started();
    const [checkout] = await db.select().from(checkouts);
    const event = paidEvent(checkout.providerRef, checkout.amountHalalas);

    await settleEvent(event, "test", {}, db);
    const second = await settleEvent(event, "test", {}, db);

    expect(second.outcome).toBe("duplicate");
    expect(await ledgerDb(db, accountId)).toBe(50);
    expect(await db.select().from(webhookEvents)).toHaveLength(1);
  });

  /**
   * The layer the webhook log cannot provide. A provider that re-delivers the
   * same payment under a *new* event id gets past `webhook_events` entirely —
   * and lands on `ledger_idempotency_idx`, which is unique on
   * (account, reason, ref) with the checkout id as the ref.
   */
  it("grants nothing when the same payment arrives under a new event id", async () => {
    await started();
    const [checkout] = await db.select().from(checkouts);

    await settleEvent(paidEvent(checkout.providerRef, checkout.amountHalalas, "evt_a"), "test", {}, db);
    const second = await settleEvent(
      paidEvent(checkout.providerRef, checkout.amountHalalas, "evt_b"),
      "test",
      {},
      db,
    );

    expect(second.outcome).toBe("granted");
    expect(await db.select().from(webhookEvents)).toHaveLength(2);
    // Two events, two records, one grant.
    expect(await ledgerDb(db, accountId)).toBe(50);
    expect(await db.select().from(ledger)).toHaveLength(1);
  });

  /** One StreamPay account serves several apps. This endpoint will see theirs. */
  it("ignores an event tagged for another product", async () => {
    await started();
    const [checkout] = await db.select().from(checkouts);
    const result = await settleEvent(
      { ...paidEvent(checkout.providerRef, checkout.amountHalalas), product: "careers" },
      "test",
      {},
      db,
    );
    expect(result.outcome).toBe("wrong_product");
    expect(await ledgerDb(db, accountId)).toBe(0);
  });

  it("records but does not credit an event for a checkout it has never seen", async () => {
    const result = await settleEvent(paidEvent("test_unknown", 9900), "test", {}, db);
    expect(result.outcome).toBe("unknown_checkout");
    expect(await ledgerDb(db, accountId)).toBe(0);
    // Still recorded, so an unmatched event is investigable rather than lost.
    expect(await db.select().from(webhookEvents)).toHaveLength(1);
  });

  it("marks a failed payment failed and grants nothing", async () => {
    await started();
    const [checkout] = await db.select().from(checkouts);
    const result = await settleEvent(
      { ...paidEvent(checkout.providerRef, checkout.amountHalalas), status: "failed" },
      "test",
      {},
      db,
    );
    expect(result.outcome).toBe("failed_payment");
    expect((await db.select().from(checkouts))[0].status).toBe("failed");
    expect(await ledgerDb(db, accountId)).toBe(0);
  });

  /** A partial capture is not a paid checkout. */
  it("refuses to grant on an amount that does not match", async () => {
    await started();
    const [checkout] = await db.select().from(checkouts);
    const result = await settleEvent(paidEvent(checkout.providerRef, 100), "test", {}, db);
    expect(result.outcome).toBe("amount_mismatch");
    expect(await ledgerDb(db, accountId)).toBe(0);
  });

  it("scopes the checkout lookup to its own provider", async () => {
    await started();
    const [checkout] = await db.select().from(checkouts);
    const result = await settleEvent(
      paidEvent(checkout.providerRef, checkout.amountHalalas),
      "streampay",
      {},
      db,
    );
    expect(result.outcome).toBe("unknown_checkout");
    expect(await ledgerDb(db, accountId)).toBe(0);
  });
});
