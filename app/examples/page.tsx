import Link from "next/link";
import { Wordmark } from "@/components/Chrome";
import { workedExamples } from "@/lib/gtm/fixtures";
import { wordCount } from "@/lib/gtm/compose";

export const metadata = {
  title: "أمثلة الرسائل — Intro",
  description: "رسائل تعارف عربية مكتوبة بالكامل، بالبيانات اللي تنتجها المنصة.",
};

/**
 * The writing, readable by anyone.
 *
 * Access: **public, and safe to be.** It reads nothing from the database and
 * touches no account — every letter here is `lib/gtm/compose.ts` run over
 * `lib/gtm/fixtures.ts` at render time. That is also why it is worth having:
 * it is the one page that shows a stranger what the product actually writes,
 * with no key configured, no credit spent and no sign-up.
 *
 * Composed live rather than pasted in as strings, so a change that quietly
 * degrades the composer shows up here immediately instead of being preserved
 * as a flattering snapshot.
 *
 * The recipients are written by hand and the page says so twice — once at the
 * top and once on every card. A fabricated person presented as a real lookup is
 * exactly what the honesty rule exists to stop, and the fix is the label.
 */
export default function ExamplesPage() {
  const examples = workedExamples();

  return (
    <div className="landing">
      <nav className="nav">
        <Link href="/" className="logo">
          <Wordmark />
        </Link>
        <div className="nav-links">
          <Link href="/examples">الأمثلة</Link>
          <Link href="/gtm">ابدأ</Link>
        </div>
      </nav>

      <div className="landing-wrap">
        <div className="stack g20" style={{ padding: "64px 0 32px", maxWidth: "72ch" }}>
          <span className="eyebrow">أمثلة</span>
          <h1 style={{ fontSize: "var(--text-3xl)", lineHeight: 1.3 }}>
            هذي الرسائل اللي نكتبها. اقرأها قبل ما تسجّل.
          </h1>
          <p className="muted" style={{ fontSize: "var(--text-lg)", lineHeight: 1.9 }}>
            كل رسالة تحت مكتوبة الآن بنفس المؤلف اللي يشتغل داخل المنتج، مو منسوخة من
            لقطة قديمة. العربي مكتوب عربيًا من الأساس، والنسخة الإنجليزية إعادة كتابة
            بنفس النبرة لا ترجمة حرفية.
          </p>
          <div className="alert stack g6">
            <strong>الأشخاص هنا مكتوبون يدويًا.</strong>
            <span>
              ما جوا من مزوّد بيانات وما يقصدون أشخاصًا حقيقيين. المرسِل هو Intro نفسها،
              عشان ما نستعير اسم شركة ثانية في عرض.
            </span>
          </div>
        </div>

        <div className="stack g20" style={{ paddingBottom: 40 }}>
          {examples.map((example, i) => (
            <article key={i} className="card stack g14">
              <div className="row between wrapx g10" style={{ alignItems: "baseline" }}>
                <div className="stack g4">
                  <h2>{example.recipient.fullName}</h2>
                  <span className="sm muted">
                    {[example.recipient.title, example.recipient.companyName]
                      .filter(Boolean)
                      .join(" · ") || "ما نعرف عنه شيء غير اسمه"}
                  </span>
                </div>
                <span className="chip on">{example.labelAr}</span>
              </div>

              <span className="sm" style={{ color: "var(--warn)" }}>
                {example.recipient.note}
              </span>

              <div className="stack g6">
                <span className="xs dim">الشريحة</span>
                <strong className="sm">{example.segment.name}</strong>
                <span className="sm muted">{example.segment.pain}</span>
              </div>

              <div className="stack g6">
                <span className="xs dim">
                  المعلومات المحددة اللي استندت عليها الرسالة
                  {example.draft.specifics.length === 0 && " — ما فيه، والرسالة تعترف بذلك"}
                </span>
                <div className="row wrapx g6">
                  {example.draft.specifics.map((s) => (
                    <span key={s.field} className="gtm-specific">
                      {s.text}
                      <span className="lat dim">· {s.field}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="stack g8">
                <span className="xs dim">
                  الموضوع · {example.draft.subjectAr}
                </span>
                <div className="gtm-letter">{example.draft.bodyAr}</div>
                <span className="xs dim">
                  {wordCount(example.draft.bodyAr)} كلمة — السقف ١٢٠ كلمة لأول رسالة
                </span>
              </div>

              <details>
                <summary
                  style={{ cursor: "pointer", fontSize: "var(--text-sm)", color: "var(--ink-2)" }}
                >
                  النسخة الإنجليزية
                </summary>
                <div className="stack g8" style={{ marginTop: 12 }}>
                  <span className="xs dim lat">Subject · {example.draft.subjectEn}</span>
                  <div className="gtm-letter gtm-letter-en">{example.draft.bodyEn}</div>
                  {!example.draft.englishComplete && (
                    <span className="sm" style={{ color: "var(--warn)" }}>
                      ما فيه مصدر إنجليزي لبعض الجمل، فاستعارت العربي. المنتج يقول لك هذا
                      بدل ما يقدّمها كرسالة إنجليزية مكتملة.
                    </span>
                  )}
                </div>
              </details>
            </article>
          ))}
        </div>

        <div className="cta-band" style={{ marginInline: -56 }}>
          <div className="landing-wrap stack g14" style={{ textAlign: "start" }}>
            <h2>جرّبها على موقعك.</h2>
            <p className="muted" style={{ maxWidth: "56ch" }}>
              حط رابط موقعك ونبني لك الشرائح والأعداد والرسائل. ما نطلب بطاقة، والدفع عند
              الإرسال فقط.
            </p>
            <Link href="/gtm" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
              ابدأ ←
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
