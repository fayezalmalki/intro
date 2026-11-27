import { Console, Forbidden } from "@/components/Chrome";
import { monitoring } from "@/lib/db/repo";
import { accountForPage } from "@/lib/session";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = {
  otp: "رمز الدخول", activation_requested: "طلب تفعيل", activated: "تفعيل", credit_request: "طلب رصيد", follow_up_digest: "تذكير المتابعات",
};
const TRANSPORT: Record<string, string> = { smtp: "ImprovMX", binding: "Cloudflare", log: "سجل فقط" };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

/**
 * Monitoring for the team: who's using the app, the sign-up funnel, what
 * people do, and every email the app sent or failed to send.
 */
export default async function MetricsPage() {
  const account = await accountForPage("account_manager");
  if (!account) return <Forbidden area="لوحة المتابعة لمديري الحسابات فقط." />;
  const m = await monitoring();
  const sentEmails = m.emails7.filter((e) => e.status === "sent").reduce((s, e) => s + e.n, 0);
  const failedEmails = m.emails7.filter((e) => e.status === "failed").reduce((s, e) => s + e.n, 0);
  const maxDay = Math.max(1, ...m.newByDay.map((d) => d.n));

  const Kpi = ({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) => (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-figure" style={warn ? { color: "var(--danger, #c8432b)" } : undefined}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );

  return (
    <Console on="metrics" account={account}>
      <div className="wrap">
        <div className="console-bar"><h1>لوحة المتابعة</h1></div>

        <h2 style={{ margin: "8px 0 12px" }}>المستخدمون</h2>
        <div className="kpis" style={{ marginBottom: 20 }}>
          <Kpi label="الحسابات" value={m.users.total} sub={`${m.users.onboarded} أكملوا التسجيل`} />
          <Kpi label="نشطون آخر 7 أيام" value={m.users.active7} sub={pct(m.users.active7, m.users.total) + " من الحسابات"} />
          <Kpi label="طلبوا رمز دخول (7 أيام)" value={m.funnel7.codes} sub={`دخلوا ${m.funnel7.verified} · أكملوا ${m.funnel7.onboarded}`} />
          <Kpi label="الإجمالي: رمز → دخول → تسجيل" value={`${m.funnelAll.codes} → ${m.funnelAll.verified} → ${m.funnelAll.onboarded}`} sub={`تحويل ${pct(m.funnelAll.onboarded, m.funnelAll.codes)}`} />
        </div>

        <div className="tbl" style={{ padding: 16, marginBottom: 28 }}>
          <div className="kpi-label" style={{ marginBottom: 10 }}>حسابات جديدة · آخر 14 يوم</div>
          {m.newByDay.length === 0 ? <span className="muted">ما فيه حسابات جديدة.</span> : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }} dir="ltr">
              {m.newByDay.map((d) => (
                <div key={d.day} title={`${d.day}: ${d.n}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 11 }}>{d.n}</span>
                  <div style={{ width: "100%", height: `${(d.n / maxDay) * 60}px`, minHeight: 2, background: "var(--accent-line, #1d3d33)", borderRadius: 4 }} />
                  <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <h2 style={{ margin: "8px 0 12px" }}>الاستخدام · آخر 7 أيام</h2>
        <div className="kpis" style={{ marginBottom: 28 }}>
          <Kpi label="بحوث" value={m.activity.searches} />
          <Kpi label="بريد مكشوف" value={m.activity.reveals} />
          <Kpi label="عملاء محفوظون" value={m.activity.saved} />
          <Kpi label="تواصل مسجّل" value={m.activity.contacted} sub={`ردود ${m.activity.replied} · اجتماعات ${m.activity.meetings}`} />
          <Kpi label="متابعات حان وقتها" value={m.activity.due} />
          <Kpi label="طلبات" value={m.activity.requests} sub={`مبيعات الرصيد: ${m.money.orders} · ${m.money.sar.toLocaleString("en")} ر.س`} />
        </div>

        <h2 style={{ margin: "8px 0 12px" }}>البريد المرسل</h2>
        <div className="kpis" style={{ marginBottom: 16 }}>
          <Kpi label="أُرسل (7 أيام)" value={sentEmails} />
          <Kpi label="فشل (7 أيام)" value={failedEmails} warn={failedEmails > 0} />
          <Kpi label="فشل آخر 24 ساعة" value={m.emailFail24} warn={m.emailFail24 > 0} />
        </div>
        <div className="tbl" style={{ marginBottom: 16 }}>
          <table>
            <thead><tr><th>النوع</th><th>الحالة</th><th>عبر</th><th>العدد (7 أيام)</th></tr></thead>
            <tbody>
              {m.emails7.map((e) => (
                <tr key={`${e.kind}${e.status}${e.transport}`}><td>{KIND[e.kind] ?? e.kind}</td><td style={{ color: e.status === "failed" ? "#c8432b" : undefined }}>{e.status === "sent" ? "أُرسل" : "فشل"}</td><td>{TRANSPORT[e.transport] ?? e.transport}</td><td>{e.n}</td></tr>
              ))}
              {m.emails7.length === 0 && <tr><td colSpan={4} className="muted">ما فيه بريد مسجّل بعد.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="tbl" style={{ marginBottom: 28 }}>
          <table>
            <thead><tr><th>آخر البريد</th><th>إلى</th><th>الحالة</th><th>عبر</th><th>الوقت</th></tr></thead>
            <tbody>
              {m.recentEmails.map((e) => (
                <tr key={e.id}>
                  <td>{KIND[e.kind] ?? e.kind}</td>
                  <td dir="ltr" style={{ textAlign: "right" }}>{e.to}</td>
                  <td style={{ color: e.status === "failed" ? "#c8432b" : undefined }} title={e.error ?? ""}>{e.status === "sent" ? "أُرسل" : `فشل${e.error ? ` · ${e.error.slice(0, 60)}` : ""}`}</td>
                  <td>{TRANSPORT[e.transport] ?? e.transport}</td>
                  <td dir="ltr" style={{ textAlign: "right" }}>{e.createdAt.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
              {m.recentEmails.length === 0 && <tr><td colSpan={5} className="muted">ما فيه بريد مسجّل بعد.</td></tr>}
            </tbody>
          </table>
        </div>

        <h2 style={{ margin: "8px 0 12px" }}>الأكثر استخدامًا</h2>
        <div className="tbl">
          <table>
            <thead><tr><th>الحساب</th><th>بحوث (7 أيام)</th><th>عملاء محفوظون</th></tr></thead>
            <tbody>
              {m.topAccounts.map((a) => <tr key={a.email}><td dir="ltr" style={{ textAlign: "right" }}>{a.email}</td><td>{a.searches}</td><td>{a.leads}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </Console>
  );
}
