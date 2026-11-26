import * as repo from "@/lib/db/repo";
import { fetchInvoice, moyasarKey } from "@/lib/billing/moyasar";

export const dynamic = "force-dynamic";

/**
 * Moyasar's invoice callback (the invoice's callback_url). The body is only a
 * hint for which invoice: we re-read it from Moyasar's API and settle on
 * that, so a forged POST can't grant anything.
 */
export async function POST(request: Request) {
  const key = moyasarKey();
  if (!key) return new Response("not configured", { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { id?: string; data?: { id?: string; invoice_id?: string } };
  const invoiceId = body.id ?? body.data?.invoice_id ?? body.data?.id;
  if (!invoiceId) return new Response("ok");
  const order = await repo.orderByInvoice(invoiceId);
  if (!order) return new Response("ok");
  const invoice = await fetchInvoice(key, invoiceId);
  if (invoice) await repo.settleOrder(order, invoice);
  return new Response("ok");
}
