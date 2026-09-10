import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { clusterBySlug, isClusterSlug } from "@/lib/radar/clusters";
import { issueByNumber } from "@/lib/radar/issues";
import { ar as arDigits } from "@/components/Chrome";
import { RadarShell, readLang } from "../../RadarChrome";
import { IssueBody } from "../../IssueBody";

export const dynamic = "force-dynamic";

/** One published issue, at a permanent URL. Immutable, so it stays quotable. */
export default async function IssuePage({
  params, searchParams,
}: {
  params: Promise<{ cluster: string; number: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { cluster: slug, number } = await params;
  const parsed = Number(number);
  if (!isClusterSlug(slug) || !Number.isInteger(parsed)) notFound();
  const found = await issueByNumber(db, slug, parsed);
  if (!found) notFound();

  const cluster = clusterBySlug(slug)!;
  const lang = readLang((await searchParams).lang);
  const ar = lang === "ar";

  return (
    <RadarShell lang={lang} here={`/radar/${slug}/${parsed}`}>
      <div className="landing-wrap">
        <section className="hero" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          <div className="stack g20">
            <span className="pill-accent">{ar ? cluster.ar : cluster.en}</span>
            <h1>{ar ? `العدد ${arDigits(found.issue.number)}` : `Issue ${found.issue.number}`}</h1>
            <p className="sm muted">
              {found.issue.publishedAt?.slice(0, 10)}
            </p>
          </div>
        </section>
      </div>
      <section className="section landing-wrap">
        <IssueBody items={found.items} lang={lang} />
      </section>
    </RadarShell>
  );
}
