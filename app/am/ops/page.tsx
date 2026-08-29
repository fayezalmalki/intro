import { Console, Forbidden, ar } from "@/components/Chrome";
import { accountForPage } from "@/lib/session";
import { otpFailureClasses, recentUsage, usageCounts } from "@/lib/usage";
import { creditsRemaining, spendSince } from "@/lib/coresignal";
import type { SmtpErrorClass } from "@/lib/mailer";
import type { UsageKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

const KIND_LABEL: Record<UsageKind, string> = {
  unlock_click: "طلب تفعيل الإرسال",
  send_refused: "إرسال مرفوض",
  send_allowed: "إرسال مسموح",
  otp_sent: "رمز مُرسل",
  otp_send_failed: "فشل إرسال رمز",
  otp_verified: "رمز مقبول",
  otp_verify_failed: "رمز مرفوض",
  account_created: "حساب جديد",
};

/**
 * What each SMTP failure class means for whoever is reading this page, in one
 * line. The classes are not interchangeable: `auth` and `from_rejected` need
 * someone to go change a setting, `timeout` usually needs nothing at all.
 */
const FAILURE_LABEL: Record<SmtpErrorClass, string> = {
  auth: "مصادقة SMTP — كلمة المرور أو الاسم غلط. يحتاج تدخل.",
  from_rejected: "المرسل مرفوض — نطاق SMTP_FROM ما يطابق الحساب. يحتاج تدخل.",
  timeout: "بطء أو انقطاع في الاتصال — غالبًا يعدّي لحاله.",
  not_configured: "SMTP غير مهيأ أصلًا — الدخول معطّل فعليًا.",
  other: "غير مصنّف — راجع سجلات الخادم.",
};

/** The two classes that mean sign-in is broken until a person fixes something. */
const CRITICAL: SmtpErrorClass[] = ["auth", "from_rejected", "not_configured"];

/**
 * The ops page: is anyone getting in, and what are we spending.
 *
 * Three questions, and nothing else. It is deliberately not a dashboard —
 * every figure here is one someone would act on:
 *
 *   • **OTP delivery health.** If codes stop arriving, nobody can sign in and
 *     no other number on this page matters. The failure *class* is shown, not
 *     just a count, because `auth` means go fix a credential and `timeout`
 *     means wait.
 *   • **Coresignal spend.** Credits are prepaid and the balance only goes down.
 *     `x-credits-remaining` is the vendor's own figure; the spend beside it is
 *     ours, from `apiCallLog`. The two disagreeing is itself a signal.
 *   • **Recent events.** The raw feed, for the questions the summaries do not
 *     anticipate.
 */
export default async function OpsPage() {
  // Same policy as the rest of the console. The pages are not the boundary —
  // there is nothing to POST here — but a requester who reaches this URL should
  // be told so rather than shown a crash page.
  const account = await accountForPage("account_manager");
  if (!account) return <Forbidden area="لوحة التشغيل مخصصة لمديري الحسابات." />;

  const now = Date.now();
  const day = new Date(now - DAY_MS);
  const week = new Date(now - 7 * DAY_MS);

  const [countsDay, countsWeek, failuresDay, failuresWeek, spendDay, spendWeek, credits, events] =
    await Promise.all([
      usageCounts(day),
      usageCounts(week),
      otpFailureClasses(day),
      otpFailureClasses(week),
      spendSince(day),
      spendSince(week),
      creditsRemaining(),
      recentUsage(60),
    ]);

  const sentDay = countsDay.get("otp_sent") ?? 0;
  const failedDay = countsDay.get("otp_send_failed") ?? 0;
  const attemptedDay = sentDay + failedDay;
  const deliveryRate = attemptedDay === 0 ? null : Math.round((sentDay / attemptedDay) * 100);
  const critical = CRITICAL.filter((c) => (failuresWeek.get(c) ?? 0) > 0);

  return (
    <Console on="ops" account={account}>
      <div className="wrap">
        <div className="console-bar">
          <h1>التشغيل</h1>
        </div>

        {/* The one alert worth interrupting for. A `timeout` class resolves
            itself; these three do not, and every minute one of them is live is
            a minute nobody new can sign in. */}
        {critical.length > 0 && (
          <div className="alert" style={{ marginBottom: 20 }}>
            <div className="stack g6">
              <strong>فيه فشل في إرسال رموز الدخول يحتاج تدخل.</strong>
              {critical.map((c) => (
                <span key={c} className="sm">
                  {FAILURE_LABEL[c]} — {ar(failuresWeek.get(c) ?? 0)} خلال آخر ٧ أيام
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="kpis" style={{ marginBottom: 24 }}>
          <div className="kpi">
            <div className="kpi-label">وصول رموز الدخول</div>
            <div
              className="kpi-figure"
              style={{
                color:
                  deliveryRate !== null && deliveryRate < 100 ? "var(--danger)" : undefined,
              }}
            >
              {deliveryRate === null ? "—" : `${ar(deliveryRate)}٪`}
            </div>
            <div className="kpi-sub">
              {attemptedDay === 0
                ? "ما فيه محاولات خلال ٢٤ ساعة"
                : `${ar(sentDay)} مُرسل · ${ar(failedDay)} فاشل — ٢٤ ساعة`}
            </div>
          </div>

          <div className="kpi">
            <div className="kpi-label">رصيد Coresignal</div>
            <div className="kpi-figure">{credits === null ? "—" : ar(credits)}</div>
            <div className="kpi-sub">
              {credits === null
                ? "ما سجّلنا أي نداء بعد"
                : "آخر قيمة من x-credits-remaining"}
            </div>
          </div>

          <div className="kpi">
            <div className="kpi-label">صرف ٢٤ ساعة</div>
            <div className="kpi-figure">{ar(spendDay.creditsSpent)}</div>
            <div className="kpi-sub">
              {ar(spendDay.paidCalls)} نداء مدفوع من {ar(spendDay.calls)}
            </div>
          </div>

          <div className="kpi">
            <div className="kpi-label">صرف ٧ أيام</div>
            <div className="kpi-figure">{ar(spendWeek.creditsSpent)}</div>
            <div className="kpi-sub">
              {ar(spendWeek.paidCalls)} نداء مدفوع من {ar(spendWeek.calls)}
            </div>
          </div>
        </div>

        <div className="mid stack g20" style={{ maxWidth: "none" }}>
          <div className="stack g10">
            <h2>الأحداث</h2>
            <span className="sm muted">
              العدّاد لكل نوع — ٢٤ ساعة مقابل ٧ أيام. الفرق بينهما هو الاتجاه.
            </span>
            <div className="tbl">
              <div className="tr head tr-ops3">
                <span>الحدث</span>
                <span>٢٤ ساعة</span>
                <span>٧ أيام</span>
              </div>
              {(Object.keys(KIND_LABEL) as UsageKind[]).map((kind) => (
                <div className="tr tr-ops3" key={kind}>
                  <span className="sm">{KIND_LABEL[kind]}</span>
                  <span className="sm muted">{ar(countsDay.get(kind) ?? 0)}</span>
                  <span className="sm muted">{ar(countsWeek.get(kind) ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>

          {failuresWeek.size > 0 && (
            <div className="stack g10">
              <h2>فشل إرسال الرموز</h2>
              <div className="tbl">
                <div className="tr head tr-ops3">
                  <span>الصنف</span>
                  <span>٢٤ ساعة</span>
                  <span>٧ أيام</span>
                </div>
                {[...failuresWeek.keys()].map((key) => {
                  const label = FAILURE_LABEL[key as SmtpErrorClass] ?? key;
                  return (
                    <div className="tr tr-ops3" key={key}>
                      <div className="stack g4">
                        <strong className="sm lat">{key}</strong>
                        <span className="xs dim">{label}</span>
                      </div>
                      <span className="sm muted">{ar(failuresDay.get(key) ?? 0)}</span>
                      <span className="sm muted">{ar(failuresWeek.get(key) ?? 0)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="stack g10">
            <h2>آخر الأحداث</h2>
            {events.length === 0 ? (
              <div className="card">
                <span className="sm muted">ما فيه أحداث مسجّلة بعد.</span>
              </div>
            ) : (
              <div className="tbl">
                <div className="tr head tr-ops">
                  <span>الوقت</span>
                  <span>الحدث</span>
                  <span>البريد</span>
                  <span>التفاصيل</span>
                </div>
                {events.map((event) => (
                  <div className="tr tr-ops" key={event.id}>
                    <span className="xs dim lat">{event.at.slice(0, 19).replace("T", " ")}</span>
                    <span className="sm">{KIND_LABEL[event.kind] ?? event.kind}</span>
                    {/* The address, not the account: most of these happen before
                        an account exists, which is the point of recording them. */}
                    <span className="xs dim lat">{event.email ?? "—"}</span>
                    <span className="xs dim lat">
                      {event.meta ? JSON.stringify(event.meta) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Console>
  );
}
