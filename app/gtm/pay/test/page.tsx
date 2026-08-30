import Link from "next/link";
import { AppBar } from "@/components/Chrome";
import { currentAccount } from "@/lib/session";
import { paymentProvider } from "@/lib/payments/provider";
import { TestPayButton } from "@/components/gtm/TestPayButton";

export const dynamic = "force-dynamic";

/**
 * The test provider's own checkout page.
 *
 * It does not mark anything paid. Pressing the button posts a signed payload to
 * `/api/webhooks/streampay` — the real route, the real signature check, the
 * real `webhook_events` insert, the real ledger write. The only thing simulated
 * is the bank.
 *
 * Saying that on the page, in Arabic, is not a courtesy. A stand-in that looks
 * like a real checkout is how a demo turns into a false claim about having
 * taken a payment.
 *
 * Access: under /gtm, so signed-in only. It refuses outright unless the running
 * environment actually has the test provider configured — a deployment with
 * StreamPay credentials must never be able to reach a page that hands out
 * credits without a bank.
 */
export default async function TestPayPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; checkout?: string; return?: string }>;
}) {
  const account = await currentAccount();
  const { ref, return: returnUrl } = await searchParams;
  const provider = paymentProvider();

  if (!provider.isTest) {
    return (
      <>
        <AppBar account={account} />
        <div className="wrap">
          <div className="narrow stack g14" style={{ paddingTop: 44 }}>
            <h1>هذي الصفحة للمزوّد التجريبي فقط.</h1>
            <p className="muted">
              هذي البيئة موصولة بمزوّد دفع حقيقي، فما فيها مسار تجريبي.
            </p>
            <Link href="/gtm" className="btn btn-primary">
              رجوع
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!ref) {
    return (
      <>
        <AppBar account={account} />
        <div className="wrap">
          <div className="narrow stack g14" style={{ paddingTop: 44 }}>
            <h1>ما فيه عملية دفع في هذا الرابط.</h1>
            <Link href="/gtm" className="btn btn-primary">
              رجوع
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppBar account={account} />
      <div className="wrap">
        <div className="narrow stack g20" style={{ paddingTop: 44 }}>
          <div className="stack g8">
            <span className="eyebrow">مزوّد دفع تجريبي</span>
            <h1>ما ينخصم من أي بطاقة.</h1>
            <p className="muted">
              ما فيه بيانات اعتماد StreamPay في هذي البيئة. الزر تحت يرسل إشعارًا موقّعًا
              لنفس مسار الويب-هوك الحقيقي — نفس التحقق من التوقيع، نفس سجل الأحداث اللي
              يمنع التكرار، ونفس دفتر الرصيد. الشيء الوحيد المحاكى هو البنك.
            </p>
          </div>

          <div className="card stack g10">
            <span className="xs dim lat">provider ref</span>
            <code className="gtm-query lat">{ref}</code>
          </div>

          <TestPayButton providerRef={ref} returnUrl={returnUrl ?? "/gtm"} />

          <Link href={returnUrl ?? "/gtm"} className="sm dim">
            إلغاء والرجوع
          </Link>
        </div>
      </div>
    </>
  );
}
