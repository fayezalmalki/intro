import { NextResponse } from "next/server";
import { paymentProvider } from "@/lib/payments/provider";
import { settleEvent } from "@/lib/payments/checkout";

export const dynamic = "force-dynamic";

/**
 * The payment webhook.
 *
 * Four properties, in the order they are enforced:
 *
 *   1. **The raw body is read once, as text.** A signature is over bytes, not
 *      over a re-serialized object — parsing first and re-stringifying to check
 *      the HMAC is the classic way to build a signature check that passes for
 *      forged payloads.
 *   2. **Signature before anything else.** An unsigned or wrongly-signed body
 *      is a 401 and is not recorded, because recording it would let anyone fill
 *      the idempotency table with event ids the real provider would later be
 *      unable to use.
 *   3. **Idempotency inside `settleEvent`**, which inserts into `webhook_events`
 *      *before* doing any work, so a retry conflicts rather than duplicating.
 *   4. **Always 200 once verified.** A verified event we cannot act on — an
 *      unknown checkout, another product's event — is recorded and acknowledged.
 *      Returning 500 would have the provider retry a payload that will never
 *      succeed, forever.
 *
 * The route lives under /api, which middleware.ts excludes from the auth
 * matcher: a provider has no session, and the signature is the credential.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const provider = paymentProvider();
  const raw = await request.text();

  const signature =
    request.headers.get("x-streampay-signature") ??
    request.headers.get("x-signature") ??
    null;

  if (!provider.verify(raw, signature)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const event = provider.parse(payload);
  if (!event) {
    // Verified, but not an event this handler models — a status we do not act
    // on, or one with no id to be idempotent about. Acknowledged so it is not
    // retried, and deliberately not recorded, because an event with no id
    // cannot be recorded meaningfully.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await settleEvent(event, provider.name, payload);
  return NextResponse.json({ ok: true, outcome: result.outcome });
}
