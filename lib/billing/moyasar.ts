import { env } from "cloudflare:workers";

/**
 * Moyasar invoices (https://docs.moyasar.com/api/invoices/01-create-invoice):
 * POST /v1/invoices returns a hosted checkout `url`; GET /v1/invoices/:id
 * is the only thing we trust for "paid". HTTP Basic, secret key as the user,
 * empty password. Amounts are in halalas.
 */
const API = "https://api.moyasar.com/v1";

export type InvoiceStatus = "initiated" | "paid" | "failed" | "refunded" | "canceled" | "on_hold" | "expired" | "voided";
export interface Invoice { id: string; status: InvoiceStatus; amount: number; currency: string; url: string; metadata?: Record<string, string> | null }

/** The secret key, or null while payments aren't configured (a placeholder value counts as unset). */
export function moyasarKey(): string | null {
  const key = (env as unknown as { MOYASAR_SECRET_KEY?: string }).MOYASAR_SECRET_KEY;
  return key && /^sk_(test|live)_/.test(key) ? key : null;
}

function auth(key: string) {
  return { authorization: `Basic ${btoa(`${key}:`)}`, "content-type": "application/json" };
}

export async function createInvoice(key: string, input: {
  amountHalalas: number; description: string; successUrl: string; backUrl: string; callbackUrl: string; metadata: Record<string, string>;
}): Promise<Invoice> {
  const r = await fetch(`${API}/invoices`, {
    method: "POST",
    headers: auth(key),
    body: JSON.stringify({
      amount: input.amountHalalas,
      currency: "SAR",
      description: input.description,
      success_url: input.successUrl,
      back_url: input.backUrl,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      // An unpaid checkout link shouldn't live forever.
      expired_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
    }),
  });
  if (!r.ok) throw new Error(`moyasar create invoice ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()) as Invoice;
}

export async function fetchInvoice(key: string, id: string): Promise<Invoice | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await fetch(`${API}/invoices/${id}`, { headers: auth(key) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`moyasar fetch invoice ${r.status}`);
  return (await r.json()) as Invoice;
}
