import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { clusterBySlug, isClusterSlug } from "@/lib/radar/clusters";
import { latestIssue, publishedIssues } from "@/lib/radar/issues";
import { ar as arDigits } from "@/components/Chrome";
import { RadarShell, readLang } from "../RadarChrome";
import { SubscribeForm } from "../SubscribeForm";
import { IssueBody } from "../IssueBody";

export const dynamic = "force-dynamic";

export default async function ClusterPage({
  params, searchParams,
}: {
  params: Promise<{ cluster: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { cluster: slug } = await params;
  if (!isClusterSlug(slug)) notFound();
  const cluster = clusterBySlug(slug)!;
  const lang = readLang((await searchParams).lang);
  const ar = lang === "ar";
  const suffix = ar ? "" : "?lang=en";

  const current = await latestIssue(db, slug);
  const archive = await publishedIssues(db, slug);

  return (
    <RadarShell lang={lang} here={`/radar/${slug}`}>
      <div className="landing-wrap">
        <section className="hero" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          <div className="stack g20">
            <span className="pill-accent">{ar ? cluster.ar : cluster.en}</span>
            <h1>
              {current
                ? ar ? `العدد ${arDigits(current.issue.number)}` : `Issue ${current.issue.number}`
                : ar ? "لم يصدر موجز بعد" : "No brief published yet"}
            </h1>
            {current ? (
              <p>
                {ar
                  ? `${arDigits(current.items.length)} تغيّر في المقاعد القيادية، وكل اسم معه مصدره.`
                  : `${current.items.length} leadership seat changes, every name with its source.`}
              </p>
            ) : (
              <p>
                {ar
                  ? "نراقب هذا القطاع أسبوعيًا. اشترك ليصلك أول موجز فور صدوره."
                  : "We watch this cluster weekly. Subscribe and the first brief reaches you when it ships."}
              </p>
            )}
            <SubscribeForm lang={lang} cluster={slug} />
          </div>
        </section>
      </div>

      {current && (
        <section className="section landing-wrap">
          <IssueBody items={current.items} lang={lang} />
        </section>
      )}

      {archive.length > 1 && (
        <section className="cta-band">
          <div className="landing-wrap stack g12">
            <span className="eyebrow">{ar ? "الأعداد السابقة" : "Past issues"}</span>
            <div className="row g16 wrapx">
              {archive.slice(1).map((issue) => (
                <Link className="sm" key={issue.id} href={`/radar/${slug}/${issue.number}${suffix}`}>
                  {ar ? `العدد ${arDigits(issue.number)}` : `Issue ${issue.number}`}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </RadarShell>
  );
}
