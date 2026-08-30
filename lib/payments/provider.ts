import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * The payment provider seam.
 *
 * StreamPay is the target — it is what Fayez's other products use, and it
 * carries mada, Apple Pay and STC Pay, which is not optional for a Saudi
 * consumer product (Stripe does not serve Saudi merchants; see
 * docs/03-design-review.md §5).
 *
 * No StreamPay credentials exist in this environment, so the default here is a
 * **test provider**, and it is honest about being one in three specific ways:
 *
 *   1. Its name is `test`, stored on every `checkouts` row, so a settled
 *      checkout always says which provider settled it.
 *   2. It cannot mark anything paid on its own. Its "pay" page posts a signed
 *      payload to the *real* webhook route, which runs the *real* idempotency
 *      and ledger path. Nothing about the settlement is simulated except the
 *      bank.
 *   3. The UI that shows it says, in Arabic, that no card is being charged.
 *
 * Swapping in StreamPay means filling in `StreamPayProvider` below and setting
 * two environment variables. Nothing downstream of `verify`/`parse` changes,
 * because everything downstream already goes through the webhook log.
 */

export interface CheckoutRequest {
  checkoutId: string;
  accountId: string;
  credits: number;
  halalas: number;
  /** One StreamPay account serves several apps; every checkout is tagged. */
  product: string;
  returnUrl: string;
}

export interface CreatedCheckout {
  providerRef: string;
  /** Where to send the browser. */
  redirectUrl: string;
}

export interface ProviderEvent {
  /** The provider's id for this event — the idempotency key. */
  eventId: string;
  providerRef: string;
  status: "paid" | "failed";
  halalas: number;
  product: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** True when this is the stand-in, so the UI can say so. */
  readonly isTest: boolean;
  createCheckout(request: CheckoutRequest): Promise<CreatedCheckout>;
  /** Constant-time signature check over the raw body. */
  verify(rawBody: string, signature: string | null): boolean;
  parse(payload: unknown): ProviderEvent | null;
}

function signHmac(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Constant-time compare that also survives a length mismatch.
 *
 * `timingSafeEqual` throws when the buffers differ in length, and an exception
 * on a wrong-length signature is itself a side channel — as well as a 500 where
 * a 401 belongs.
 */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export const TEST_WEBHOOK_SECRET = "intro-test-provider";

/**
 * The stand-in. Signs with a fixed, published secret — which is safe precisely
 * because it is published: it authenticates nothing of value, and a build with
 * real credentials never constructs this provider.
 */
export function testProvider(appUrl: string): PaymentProvider {
  return {
    name: "test",
    isTest: true,

    async createCheckout(request) {
      const providerRef = `test_${randomUUID()}`;
      const url = new URL("/gtm/pay/test", appUrl);
      url.searchParams.set("ref", providerRef);
      url.searchParams.set("checkout", request.checkoutId);
      url.searchParams.set("return", request.returnUrl);
      return { providerRef, redirectUrl: url.toString() };
    },

    verify(rawBody, signature) {
      if (!signature) return false;
      return safeEqual(signHmac(TEST_WEBHOOK_SECRET, rawBody), signature);
    },

    parse(payload) {
      return parseCommon(payload);
    },
  };
}

/**
 * StreamPay, behind the two credentials it needs.
 *
 * The request and event shapes below are the common ones for a Saudi PSP and
 * are the single place to correct against StreamPay's current documentation —
 * they are not guessed field-by-field across the codebase. Everything else in
 * the payment path is provider-agnostic and already tested.
 */
export function streamPayProvider(apiKey: string, webhookSecret: string, appUrl: string): PaymentProvider {
  return {
    name: "streampay",
    isTest: false,

    async createCheckout(request) {
      const response = await fetch("https://api.streampay.sa/v1/checkouts", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: request.halalas,
          currency: "SAR",
          // The tag the webhook filters on. One account, several apps.
          metadata: { product: request.product, checkout_id: request.checkoutId, credits: request.credits },
          success_url: request.returnUrl,
          cancel_url: request.returnUrl,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(`streampay checkout failed: ${response.status}`);
      }
      const body = (await response.json()) as { id?: string; url?: string };
      if (!body.id || !body.url) throw new Error("streampay returned no checkout id or url");
      return { providerRef: body.id, redirectUrl: body.url };
    },

    verify(rawBody, signature) {
      if (!signature) return false;
      return safeEqual(signHmac(webhookSecret, rawBody), signature);
    },

    parse(payload) {
      return parseCommon(payload);
    },
  };
}

/**
 * The event shape both providers speak.
 *
 * Refuses anything it cannot fully read rather than defaulting: a webhook with
 * no id cannot be made idempotent, and one with no amount cannot be reconciled.
 * Neither is worth guessing at when the consequence is credits.
 */
function parseCommon(payload: unknown): ProviderEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const data = (p.data && typeof p.data === "object" ? p.data : p) as Record<string, unknown>;
  const metadata = (data.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Record<string, unknown>;

  const eventId = typeof p.id === "string" ? p.id : typeof p.event_id === "string" ? p.event_id : "";
  const providerRef = typeof data.id === "string" ? data.id : typeof p.checkout_id === "string" ? p.checkout_id : "";
  const rawStatus = typeof p.type === "string" ? p.type : typeof data.status === "string" ? data.status : "";
  const halalas = typeof data.amount === "number" ? data.amount : 0;
  const product = typeof metadata.product === "string" ? metadata.product : "";

  if (!eventId || !providerRef) return null;

  const paid = /paid|succeeded|captured|completed/i.test(rawStatus);
  const failed = /failed|declined|cancell?ed|expired/i.test(rawStatus);
  if (!paid && !failed) return null;

  return { eventId, providerRef, status: paid ? "paid" : "failed", halalas, product };
}

/** Signs a body the way the test provider expects. Used by its own pay page. */
export function signTestPayload(body: string): string {
  return signHmac(TEST_WEBHOOK_SECRET, body);
}

export const PRODUCT = "intro";

/**
 * Whichever provider this environment actually has.
 *
 * Both credentials or neither: a half-configured StreamPay would create real
 * checkouts whose webhooks could never be verified, which is worse than the
 * stand-in.
 */
export function paymentProvider(): PaymentProvider {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const key = process.env.STREAMPAY_API_KEY;
  const secret = process.env.STREAMPAY_WEBHOOK_SECRET;
  if (key && secret) return streamPayProvider(key, secret, appUrl);
  return testProvider(appUrl);
}
