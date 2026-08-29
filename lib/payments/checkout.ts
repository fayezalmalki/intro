import { and, eq } from "drizzle-orm";
import type { Database } from "../db";
import { db as defaultDb } from "../db";
import { checkouts, ledger } from "../db/schema";
import { markProcessed, recordWebhookEvent } from "../webhooks";
import { logUsage } from "../usage";
import type { Bundle } from "./pricing";
import { PRODUCT, type PaymentProvider, type ProviderEvent } from "./provider";

/**
 * Creating a checkout, and settling one.
 *
 * The settlement path is the one that has to be right, and it is built in the
 * order that makes it right:
 *
 *   1. **Record the event first.** `recordWebhookEvent` inserts against
 *      `webhook_events_provider_event_idx`, so the second arrival of the same
 *      event conflicts *before* any work is done. A handler that does the work
 *      and then records is not idempotent, it is merely usually idempotent.
 *   2. **Grant through the ledger with the checkout id as `ref`.**
 *      `ledger_idempotency_idx` is unique on (account, reason, ref), so even a
 *      provider that changes its event id between retries cannot double an
 *      account's credits.
 *   3. **Mark processed last.** An event received but never processed stays
 *      visibly unfinished rather than silently lost.
 *
 * Two independent layers because they fail differently: layer 1 catches an
 * exact retry, layer 2 catches the same payment arriving under a new event id.
 * Neither alone is enough, and the second is the one that survives a provider
 * changing its retry semantics without telling anyone.
 */

export interface StartedCheckout {
  checkoutId: string;
  redirectUrl: string;
  provider: string;
  isTest: boolean;
}

export async function startCheckout(
  input: { accountId: string; bundle: Bundle; returnUrl: string },
  provider: PaymentProvider,
  database: Database = defaultDb,
): Promise<StartedCheckout> {
  const [row] = await database
    .insert(checkouts)
    .values({
      accountId: input.accountId,
      provider: provider.name,
      // Filled in below. A placeholder rather than a nullable column: a
      // checkout with no provider reference is not a state worth modelling.
      providerRef: `pending:${crypto.randomUUID()}`,
      product: PRODUCT,
      credits: input.bundle.credits,
      amountHalalas: input.bundle.halalas,
      status: "created",
    })
    .returning();

  const created = await provider.createCheckout({
    checkoutId: row.id,
    accountId: input.accountId,
    credits: input.bundle.credits,
    halalas: input.bundle.halalas,
    product: PRODUCT,
    returnUrl: input.returnUrl,
  });

  await database
    .update(checkouts)
    .set({ providerRef: created.providerRef })
    .where(eq(checkouts.id, row.id));

  await logUsage(
    {
      kind: "checkout_started",
      accountId: input.accountId,
      meta: { checkoutId: row.id, provider: provider.name, credits: input.bundle.credits },
    },
    database,
  );

  return {
    checkoutId: row.id,
    redirectUrl: created.redirectUrl,
    provider: provider.name,
    isTest: provider.isTest,
  };
}

export type SettleOutcome =
  | "granted"
  | "duplicate"
  | "unknown_checkout"
  | "wrong_product"
  | "failed_payment"
  | "amount_mismatch";

export interface SettleResult {
  outcome: SettleOutcome;
  credits: number;
}

/**
 * Settles one provider event. Safe to call with the same event any number of
 * times.
 *
 * `wrong_product` is not paranoia: one StreamPay account serves several of
 * Fayez's apps, so this endpoint will genuinely receive events belonging to
 * careers.sa. Crediting an intro account for a careers purchase would be a
 * silent, hard-to-find loss of money, and the check that prevents it is one
 * line — but only if the product tag is on the checkout in the first place.
 */
export async function settleEvent(
  event: ProviderEvent,
  providerName: string,
  rawPayload: unknown,
  database: Database = defaultDb,
): Promise<SettleResult> {
  const record = await recordWebhookEvent(providerName, event.eventId, rawPayload, database);
  if (!record.fresh) return { outcome: "duplicate", credits: 0 };

  const [checkout] = await database
    .select()
    .from(checkouts)
    .where(and(eq(checkouts.provider, providerName), eq(checkouts.providerRef, event.providerRef)))
    .limit(1);

  if (!checkout) {
    await markProcessed(record.id, database);
    return { outcome: "unknown_checkout", credits: 0 };
  }

  // The event's own product tag, when it carries one. An event for another app
  // on the same provider account is not ours to act on.
  if (event.product && event.product !== checkout.product) {
    await markProcessed(record.id, database);
    return { outcome: "wrong_product", credits: 0 };
  }

  if (event.status !== "paid") {
    await database
      .update(checkouts)
      .set({ status: "failed", settledAt: new Date().toISOString() })
      .where(eq(checkouts.id, checkout.id));
    await markProcessed(record.id, database);
    return { outcome: "failed_payment", credits: 0 };
  }

  // A "paid" event for less than the checkout asked for is not a paid checkout.
  // Refusing loudly beats granting credits for a partial capture.
  if (event.halalas > 0 && event.halalas !== checkout.amountHalalas) {
    await markProcessed(record.id, database);
    return { outcome: "amount_mismatch", credits: 0 };
  }

  await database.transaction(async (tx) => {
    await tx
      .update(checkouts)
      .set({ status: "paid", settledAt: new Date().toISOString() })
      .where(eq(checkouts.id, checkout.id));

    // The second idempotency layer. Even an event id that changed between
    // retries lands on the same (account, reason, ref) and writes nothing.
    await tx
      .insert(ledger)
      .values({
        accountId: checkout.accountId,
        delta: checkout.credits,
        reason: "purchase",
        ref: checkout.id,
      })
      .onConflictDoNothing();
  });

  await logUsage(
    {
      kind: "checkout_paid",
      accountId: checkout.accountId,
      meta: { checkoutId: checkout.id, credits: checkout.credits, provider: providerName },
    },
    database,
  );
  await markProcessed(record.id, database);
  return { outcome: "granted", credits: checkout.credits };
}
