import { and, desc, eq } from "drizzle-orm";
import { Console, Forbidden } from "@/components/Chrome";
import { db } from "@/lib/db";
import { radarCompanies, radarIssues, radarRuns, radarSignals } from "@/lib/db/schema";
import { broadcastPlan } from "@/lib/radar/broadcast";
import { CLUSTERS } from "@/lib/radar/clusters";
import { RESOLVE_COST } from "@/lib/radar/resolve";
import { accountForPage } from "@/lib/session";
import { approveSignal, dropSignal, publishCluster, seedDemoWeek, sweepNow } from "@/lib/radar/actions";
import { devToolsEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * The review desk.
 *
 * Detection is automatic and costs nothing, so this screen is where the money
 * and the editorial judgement both live: approving a change buys a name for
 * 20 credits and is the only way one reaches a public page. The button says the
 * price before it is pressed, for the same reason the GTM paywall does.
 *
 * A detected row shows a vendor id and a company and nothing else, because that
 * is genuinely all we know before paying. Showing a placeholder name would
 * misrepresent what the sweep found.
 */
export default async function RadarDeskPage() {
  const account = await accountForPage("account_manager");
  if (!account) return <Forbidden area="مكتب الرادار مخصص لمديري الحسابات." />;

  const [lastRun] = await db.select().from(radarRuns).orderBy(desc(radarRuns.startedAt)).limit(1);
  const plan = broadcastPlan();
  const companies = await db.select().from(radarCompanies);
  const byId = new Map(companies.map((c) => [c.id, c]));

  const detected = await db.select().from(radarSignals)
    .where(eq(radarSignals.status, "detected")).orderBy(desc(radarSignals.detectedAt));
  const approved = await db.select().from(radarSignals)
    .where(eq(radarSignals.status, "approved"));
  const published = await db.select().from(radarIssues)
    .where(eq(radarIssues.status, "published")).orderBy(desc(radarIssues.number));

  const staleness = lastRun
    ? Math.floor((Date.now() - new Date(lastRun.startedAt).getTime()) / 86_400_000)
    : null;

  return (
    <Console on="radar" account={account}>
      <div className="wrap stack g20">
        <div className="row g16 wrapx">
          <div className="stack g4 grow">
            <h1>الرادار</h1>
            <span className="sm muted">
              الرصد مجاني وتلقائي. اعتماد أي تغيير يشتري الاسم ومصدره بـ{RESOLVE_COST} رصيد،
              وهو الطريق الوحيد لظهوره في موجز منشور.
            </span>
          </div>
          <form action={sweepNow}>
            <button type="submit" className="btn">شغّل المسح الآن</button>
          </form>
          {/* Development only, and refused outright in production by
              assertDevTools — the loop needs a vendor key at two separate
              steps, so without this there is no way to see a published issue
              on a laptop. */}
          {devToolsEnabled && (
            <form action={seedDemoWeek}>
              <button type="submit" className="btn">أسبوع تجريبي</button>
            </form>
          )}
        </div>

        {/* A quiet week and a dead sweep must never look the same. */}
        <div className="kpis">
          <div className="kpi">
            <div className="kpi-label">آخر مسح</div>
            <div className="kpi-figure">
              {lastRun ? (staleness === 0 ? "اليوم" : `قبل ${staleness} يوم`) : "لم يُشغَّل"}
            </div>
            <div className="kpi-sub">
              {lastRun
                ? lastRun.status === "failed"
                  ? `تعثّر: ${lastRun.error?.slice(0, 80) ?? "بدون تفاصيل"}`
                  : `${lastRun.companiesChecked} جهة · ${lastRun.signalsDetected} تغيير`
                : "لا يوجد سجل مسح بعد"}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">بانتظار المراجعة</div>
            <div className="kpi-figure">{detected.length}</div>
            <div className="kpi-sub">تغييرات مرصودة بلا اسم بعد</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">معتمدة للنشر</div>
            <div className="kpi-figure">{approved.length}</div>
            <div className="kpi-sub">اشتُري لها اسم ومصدر</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">البثّ البريدي</div>
            <div className="kpi-figure">{plan.enabled ? "مفعّل" : "متوقف"}</div>
            {/* The enum, not `plan.reason`: that string is English for logs and
                the API, and an English sentence dropped into an RTL card has
                its full stop reordered to the front by the bidi algorithm. */}
            <div className="kpi-sub">
              {plan.refusal === "no_radar_sender"
                ? "يحتاج الرادار نطاقًا فرعيًا خاصًا للإرسال. لا يجوز أن يشارك نطاق رسائل الدخول."
                : plan.refusal === "disabled"
                  ? "الموجز يُنشر على صفحته العامة، ولا يُرسل بريد بعد."
                  : "مفعّل ويُرسل لكل من أكّد اشتراكه."}
            </div>
          </div>
        </div>

        {lastRun?.skips?.length ? (
          <div className="card stack g8">
            <strong className="sm">جهات لم تُقارَن في آخر مسح</strong>
            <span className="xs muted">
              المقارنة تُرفض عمدًا حين تكون النتيجة ناقصة أو فارغة — الغياب لا يعني المغادرة.
            </span>
            {lastRun.skips.map((s, i) => (
              <span className="xs" key={`${s.company}-${i}`}>
                <strong>{s.company}</strong> — <span className="lat">{s.reason}</span>
              </span>
            ))}
          </div>
        ) : null}

        {CLUSTERS.map((cluster) => {
          const clusterDetected = detected.filter((s) => s.clusterSlug === cluster.slug);
          const clusterApproved = approved.filter((s) => s.clusterSlug === cluster.slug);
          const issues = published.filter((i) => i.clusterSlug === cluster.slug);
          if (!clusterDetected.length && !clusterApproved.length && !issues.length) return null;

          return (
            <div className="stack g12" key={cluster.slug}>
              <div className="row g16 wrapx">
                <strong className="grow">{cluster.ar}</strong>
                <span className="xs muted">
                  {issues.length ? `آخر موجز: العدد ${issues[0].number}` : "لم يُنشر موجز بعد"}
                </span>
                {clusterApproved.length > 0 && (
                  <form action={publishCluster.bind(null, cluster.slug)}>
                    <button type="submit" className="btn btn-sm btn-primary">
                      انشر {clusterApproved.length} تغييرًا
                    </button>
                  </form>
                )}
              </div>

              {clusterApproved.map((s) => (
                <div className="card row g12 wrapx" key={s.id}>
                  <span className="badge accent">معتمد</span>
                  <span className="stack g4 grow">
                    <strong className="sm">{s.personName}</strong>
                    <span className="xs muted">
                      {s.personTitle} · {byId.get(s.companyId)?.name}
                      {" · "}
                      {s.kind === "arrival" ? "التحق" : "غادر"}
                    </span>
                  </span>
                  <span className="xs dim">{s.creditsSpent} رصيد</span>
                </div>
              ))}

              {clusterDetected.map((s) => (
                <div className="card row g12 wrapx" key={s.id}>
                  <span className="badge">{s.kind === "arrival" ? "التحاق" : "مغادرة"}</span>
                  <span className="stack g4 grow">
                    <strong className="sm">{byId.get(s.companyId)?.name ?? "جهة غير معروفة"}</strong>
                    {/* No name yet, and no invented one: this is all the free
                        search returned. */}
                    <span className="xs muted">
                      مقعد قيادي تغيّر · المعرّف <span className="lat">#{s.coresignalEmployeeId}</span>
                    </span>
                  </span>
                  <form action={approveSignal.bind(null, s.id)}>
                    <button type="submit" className="btn btn-sm">
                      اعتمد ({RESOLVE_COST} رصيد)
                    </button>
                  </form>
                  <form action={dropSignal.bind(null, s.id)}>
                    <button type="submit" className="btn btn-sm">استبعد</button>
                  </form>
                </div>
              ))}
            </div>
          );
        })}

        {!detected.length && !approved.length && (
          <div className="card stack g8">
            <strong className="sm">لا توجد تغييرات بانتظار المراجعة.</strong>
            <span className="xs muted">
              {lastRun
                ? "المسح اشتغل ولم يجد تغييرًا في المقاعد القيادية — أسبوع هادئ، وهذه نتيجة صحيحة."
                : "لم يُشغَّل المسح بعد. أول تشغيل يبني خط الأساس ولا يبلّغ عن شيء."}
            </span>
          </div>
        )}
      </div>
    </Console>
  );
}
