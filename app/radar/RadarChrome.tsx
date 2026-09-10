import Link from "next/link";
import { Wordmark } from "@/components/Chrome";
import { CLUSTERS } from "@/lib/radar/clusters";

export type Lang = "ar" | "en";

/**
 * The briefing's public shell, sharing the landing's chrome and its bilingual
 * mechanic: `?lang=en` read on the server, the toggle a <Link>, `dir` on the
 * wrapper rather than <html> because the console screens have no English tree.
 */
export function RadarShell({
  lang, here, children,
}: { lang: Lang; here: string; children: React.ReactNode }) {
  const other = lang === "ar" ? `${here}?lang=en` : here;
  return (
    <div className="landing" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <header className="nav">
        <div className="row g16 wrapx" style={{ gap: 48 }}>
          <Link href={lang === "ar" ? "/" : "/?lang=en"} className="logo">
            <Wordmark />
          </Link>
          <nav className="nav-links">
            <Link href={lang === "ar" ? "/radar" : "/radar?lang=en"}>
              {lang === "ar" ? "الرادار" : "Radar"}
            </Link>
          </nav>
        </div>
        <div className="row g16 wrapx">
          <div className="seg" aria-label={lang === "ar" ? "لغة الواجهة" : "Interface language"}>
            {lang === "en"
              ? <span className="lat on" aria-current="true">EN</span>
              : <Link href={other} className="lat">EN</Link>}
            {lang === "ar"
              ? <span className="on" aria-current="true">عربي</span>
              : <Link href={other}>عربي</Link>}
          </div>
          <Link href="/new" className="btn btn-primary btn-sm">
            {lang === "ar" ? "ابدأ الآن" : "Get started"}
          </Link>
        </div>
      </header>
      {children}
      <footer className="foot">
        <div className="landing-wrap">
          <div className="foot-grid">
            <div className="stack g14">
              <Wordmark on="ink" size="lg" />
              <p className="sm" style={{ maxWidth: "40ch" }}>
                {lang === "ar"
                  ? "الرادار: تغيّرات المقاعد القيادية في السوق السعودي، مرتبطة بأشخاص يمكن الوصول إليهم."
                  : "Radar: leadership seat changes in the Saudi market, tied to people you can reach."}
              </p>
            </div>
            <div className="stack g10">
              <span className="eyebrow" style={{ color: "var(--on-dark-2)" }}>
                {lang === "ar" ? "القطاعات" : "Clusters"}
              </span>
              {CLUSTERS.slice(0, 3).map((c) => (
                <Link key={c.slug} href={`/radar/${c.slug}${lang === "en" ? "?lang=en" : ""}`}>
                  {lang === "ar" ? c.ar : c.en}
                </Link>
              ))}
            </div>
            <div className="stack g10">
              <span className="eyebrow" style={{ color: "var(--on-dark-2)" }}>&nbsp;</span>
              {CLUSTERS.slice(3).map((c) => (
                <Link key={c.slug} href={`/radar/${c.slug}${lang === "en" ? "?lang=en" : ""}`}>
                  {lang === "ar" ? c.ar : c.en}
                </Link>
              ))}
            </div>
          </div>
          <div className="foot-legal">
            <span>© {new Date().getFullYear()} Intro</span>
            <span className="lat">intro.sa</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function readLang(value?: string): Lang {
  return value === "en" ? "en" : "ar";
}
