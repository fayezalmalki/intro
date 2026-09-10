import Link from "next/link";
import { db } from "@/lib/db";
import { CLUSTERS } from "@/lib/radar/clusters";
import { latestIssue } from "@/lib/radar/issues";
import { ar as arDigits } from "@/components/Chrome";
import { RadarShell, readLang } from "./RadarChrome";
import { SubscribeForm } from "./SubscribeForm";

export const dynamic = "force-dynamic";

export default async function RadarIndex({
  searchParams,
}: { searchParams: Promise<{ lang?: string }> }) {
  const lang = readLang((await searchParams).lang);
  const ar = lang === "ar";
  const suffix = ar ? "" : "?lang=en";

  const latest = await Promise.all(
    CLUSTERS.map(async (c) => ({ cluster: c, issue: await latestIssue(db, c.slug) })),
  );

  return (
    <RadarShell lang={lang} here="/radar">
      <div className="landing-wrap">
        <section className="hero" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          <div className="stack g20">
            <span className="pill-accent">{ar ? "الرادار" : "Radar"}</span>
            <h1>{ar ? "إشارة تنتهي باسم." : "Signal that ends with a name."}</h1>
            <p>
              {ar
                ? "من تولّى مقعدًا قياديًا في السوق السعودي هذا الأسبوع، ومن غادره — لكل قطاع موجزه، ولكل اسم مصدره المؤرّخ. التحليل الذي لا ينتهي باسم لا ينفع."
                : "Who took a leadership seat in the Saudi market this week, and who left one — a brief per sector, every name carrying a dated source. Analysis that never names anyone is trivia."}
            </p>
            <SubscribeForm lang={lang} />
          </div>
        </section>
      </div>

      <section className="section landing-wrap">
        <div className="dir-grid">
          {latest.map(({ cluster, issue }) => (
            <div className="dir-cell stack g12" key={cluster.slug}>
              <span className="dir-kicker">{ar ? cluster.ar : cluster.en}</span>
              {issue ? (
                <>
                  <strong style={{ fontSize: "var(--text-lg)" }}>
                    {ar ? `العدد ${arDigits(issue.issue.number)}` : `Issue ${issue.issue.number}`}
                  </strong>
                  <p className="sm muted">
                    {ar
                      ? `${arDigits(issue.items.length)} تغيّر في المقاعد القيادية`
                      : `${issue.items.length} leadership seat changes`}
                  </p>
                  <Link className="sm" href={`/radar/${cluster.slug}${suffix}`}>
                    {ar ? "اقرأ الموجز ←" : "Read the brief →"}
                  </Link>
                </>
              ) : (
                <>
                  <strong style={{ fontSize: "var(--text-lg)" }}>
                    {ar ? "لم يصدر بعد" : "Not published yet"}
                  </strong>
                  {/* No invented issue, no placeholder count. */}
                  <p className="sm muted">
                    {ar
                      ? "نراقب هذا القطاع، ولم يصدر له موجز حتى الآن."
                      : "We watch this cluster; no brief has been published for it yet."}
                  </p>
                  <Link className="sm" href={`/radar/${cluster.slug}${suffix}`}>
                    {ar ? "اشترك فيه ←" : "Subscribe to it →"}
                  </Link>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </RadarShell>
  );
}
