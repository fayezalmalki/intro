import { ar } from "@/components/Chrome";
import { BUNDLES, formatSar, HALALAS_PER_CREDIT } from "@/lib/payments/pricing";
import { beginCheckout } from "@/lib/gtm/actions";

/**
 * The paywall, and everything it is careful not to do.
 *
 * It states three things plainly, because a price that needs explaining later
 * is a price that was not stated: what a credit is, what it buys, and what this
 * action costs right now — which today is nothing, because sending is off and
 * copying is free.
 *
 * What is deliberately absent: a countdown, a spot counter, a "usually 199",
 * a testimonial, a logo wall, a reply-rate statistic. Explee's paywall runs a
 * timer and claims six trial spots remain this hour. That is fabricated
 * scarcity, and the standing rule across Fayez's products is that a number that
 * is not real does not ship. There is no number on this panel that is not
 * arithmetic over the bundle beside it.
 *
 * The bundles are flat-rate on purpose and the copy says so: under a per-send
 * meter, a volume discount is a subsidy for exactly the behaviour the
 * near-duplicate detector spends its time refusing.
 */
export function Paywall({
  runId,
  balance,
  approved,
  providerName,
  isTest,
}: {
  runId: string;
  balance: number;
  approved: number;
  providerName: string;
  isTest: boolean;
}) {
  return (
    <section className="card stack g16" id="paywall">
      <div className="stack g6">
        <span className="eyebrow">رصيد الإرسال</span>
        <h2>وش يشتري الرصيد بالضبط</h2>
        <p className="muted" style={{ maxWidth: "62ch" }}>
          رصيد واحد = رسالة واحدة تُرسل من Intro وتمر على بوابة الإرسال. البحث والشرائح
          والأعداد وكتابة المسودات كلها مجانية وتبقى مجانية — القيمة تشوفها قبل ما ندفعك
          للدفع، والدفع عند الإرسال فقط.
        </p>
      </div>

      <div className="note stack g6">
        <strong>هذي الشاشة ما تخصم منك شيء اليوم.</strong>
        <span>
          الإرسال من Intro موقوف حاليًا، والنسخ وفتح LinkedIn وفتح بريدك مجانية دائمًا وما
          تحتاج رصيدًا. الرصيد اللي تشتريه ينحفظ في حسابك لين يشتغل الإرسال.
        </span>
      </div>

      <div className="row between wrapx g12">
        <span className="sm muted">
          رصيدك الحالي: <strong>{ar(balance)}</strong> · مسودات معتمدة: <strong>{ar(approved)}</strong>
        </span>
        <span className="sm dim">
          سعر الوحدة {formatSar(HALALAS_PER_CREDIT)} في كل الباقات — الباقة الأكبر تشتري راحة، لا خصمًا.
        </span>
      </div>

      <div className="gtm-bundles">
        {BUNDLES.map((bundle) => (
          <form action={beginCheckout} key={bundle.id}>
            <input type="hidden" name="runId" value={runId} />
            <input type="hidden" name="bundle" value={bundle.id} />
            <button type="submit" className="gtm-bundle">
              <span className="gtm-price">
                <span className="gtm-price-figure">{ar(bundle.credits)}</span>
                <span className="sm muted">رصيد</span>
              </span>
              <span className="sm">{formatSar(bundle.halalas)}</span>
              <span className="xs dim">
                {formatSar(HALALAS_PER_CREDIT)} للرسالة الواحدة
              </span>
              <span className="btn btn-sm btn-strong" style={{ marginTop: 6 }}>
                ادفع بـmada أو Apple Pay
              </span>
            </button>
          </form>
        ))}
      </div>

      {isTest ? (
        <div className="alert stack g6">
          <strong>مزوّد دفع تجريبي</strong>
          <span>
            ما فيه بيانات اعتماد StreamPay في هذي البيئة، فالدفع يمر على مزوّد تجريبي اسمه
            «{providerName}». ما ينخصم من أي بطاقة، والصفحة اللي تليها تشرح ذلك وتُرسل
            إشعارًا موقّعًا لنفس مسار الويب-هوك الحقيقي — نفس التحقق، نفس دفتر الرصيد.
          </span>
        </div>
      ) : (
        <span className="sm dim">
          الدفع عبر StreamPay — mada وApple Pay وSTC Pay. ما نحفظ بيانات بطاقتك عندنا.
        </span>
      )}
    </section>
  );
}
