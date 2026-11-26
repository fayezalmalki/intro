import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { Btn, Empty } from "@/components/app/ui";
import { pickLang } from "@/components/site/AuthShell";
import { fetchInvoice, moyasarKey } from "@/lib/billing/moyasar";
import * as repo from "@/lib/db/repo";
import { pageAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment · intro" };

/** Back from Moyasar: confirm the order with Moyasar's API, never the redirect. */
export default async function BillingReturn({ searchParams }: { searchParams: Promise<{ order?: string; lang?: string }> }) {
  const { order: orderId, lang: l } = await searchParams;
  const account = await pageAccount("/billing");
  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const order = orderId ? await repo.getOrder(orderId) : null;
  if (!order || order.accountId !== account.id) notFound();

  let state: "paid" | "pending" | "failed" = order.status === "paid" ? "paid" : "pending";
  const key = moyasarKey();
  if (state !== "paid" && key && order.invoiceId) {
    const invoice = await fetchInvoice(key, order.invoiceId);
    if (invoice) state = await repo.settleOrder(order, invoice);
  }
  const credits = await repo.creditBalance(account.id);
  const ar = lang === "ar";
  const copy = {
    paid: ar ? [`أضفنا ${order.credits} رصيد لحسابك`, "شكرًا لك. رصيدك جاهز للبحث وكشف البريد."] : [`${order.credits} credits added`, "Thank you — your balance is ready for searches and reveals."],
    pending: ar ? ["الدفع قيد التأكيد", "ما وصلنا تأكيد الدفع بعد. حدّث الصفحة بعد لحظات، ويُضاف رصيدك تلقائيًا أول ما يتأكد."] : ["Confirming your payment", "We haven't received confirmation yet. Refresh in a moment — credits are added automatically once it clears."],
    failed: ar ? ["ما اكتمل الدفع", "ما خُصم منك شيء. تقدر تحاول مرة ثانية."] : ["The payment didn't go through", "You weren't charged. You can try again."],
  }[state];

  return (
    <AppShell account={account} lang={lang} on="billing" credits={credits}>
      <div className="mx-auto max-w-[560px]">
        {state === "pending" && <meta httpEquiv="refresh" content="5" />}
        <Empty icon={state === "paid" ? "check-circle" : state === "pending" ? "clock" : "ban"} title={copy[0]} body={copy[1]}>
          <div className="flex flex-wrap gap-2">
            <Btn href={`/search?lang=${lang}`} icon="search">{ar ? "ابدأ البحث" : "Start searching"}</Btn>
            <Btn href={`/billing?lang=${lang}`} variant="secondary">{ar ? "الرصيد والمشتريات" : "Billing"}</Btn>
          </div>
        </Empty>
      </div>
    </AppShell>
  );
}
