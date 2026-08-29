"use server";

import { redirect } from "next/navigation";
import { currentAccount } from "../session";
import { paymentProvider, PRODUCT, signTestPayload } from "./provider";
import { settleEvent } from "./checkout";
import { db } from "../db";
import { checkouts } from "../db/schema";
import { and, eq } from "drizzle-orm";

/**
 * The test provider's settlement, which is deliberately not a shortcut.
 *
 * It builds the same payload StreamPay would send, signs it with the test
 * secret, verifies that signature through the provider's own `verify`, parses
 * it through the provider's own `parse`, and hands the result to the same
 * `settleEvent` a real webhook would reach. Nothing about the idempotency, the
 * product check, the amount check or the ledger write is bypassed.
 *
 * It could have called `settleEvent` directly with a hand-made event. It does
 * not, because the value of a stand-in is that it exercises the real path —
 * a shortcut here would leave the signature check and the parser untested by
 * the only flow anyone can actually run without credentials.
 *
 * Refuses outright unless this environment really is on the test provider. A
 * deployment with StreamPay credentials must not have a route that grants
 * credits without a bank.
 */
export async function payWithTestProvider(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const provider = paymentProvider();
  if (!provider.isTest) {
    throw new Error("The test payment route is unavailable when a real provider is configured.");
  }

  const providerRef = String(formData.get("providerRef") ?? "");
  const returnUrl = String(formData.get("returnUrl") ?? "/gtm");
  if (!providerRef) return;

  // Scoped to the caller: settling someone else's checkout would credit their
  // account from this session's button.
  const [checkout] = await db
    .select()
    .from(checkouts)
    .where(
      and(
        eq(checkouts.providerRef, providerRef),
        eq(checkouts.provider, provider.name),
        eq(checkouts.accountId, account.id),
      ),
    )
    .limit(1);
  if (!checkout) return;

  const payload = {
    id: `evt_test_${checkout.id}`,
    type: "checkout.paid",
    data: {
      id: providerRef,
      amount: checkout.amountHalalas,
      currency: "SAR",
      status: "paid",
      metadata: { product: PRODUCT, checkout_id: checkout.id },
    },
  };

  const raw = JSON.stringify(payload);
  if (!provider.verify(raw, signTestPayload(raw))) {
    throw new Error("The test provider failed to verify its own signature.");
  }

  const event = provider.parse(payload);
  if (!event) throw new Error("The test provider produced an event it cannot parse.");

  await settleEvent(event, provider.name, payload, db);
  redirect(returnUrl);
}
