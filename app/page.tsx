import Link from "next/link";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * The public landing.
 *
 * This is the one screen a visitor sees before they have an account, and it
 * was missing entirely: "/" used to be the intake form, so the whole pitch the
 * demo opens with — what Intro does, why it is not a contact list, what a
 * result looks like — had nowhere to live. Copy and structure follow the
 * prototype rather than being reinvented.
 *
 * Deliberately unauthenticated. Sign-in is a link in the nav, as the demo has
 * it, not a wall in front of the product.
 */
export default async function LandingPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  return (
    <div className="landing">
      <header className="bar">
        <div className="bar-left">
          <Link href="/" className="logo">
            intro<span>.</span>
          </Link>
        </div>
        <nav className="bar-nav">
          <a href="#how">كيف يعمل</a>
          <a href="#example">للشركات</a>
          {signedIn ? (
            <Link href="/new">طلباتي</Link>
          ) : (
            <Link href="/login">تسجيل الدخول</Link>
          )}
        </nav>
      </header>

      <section className="hero">
        <h1>مين ودك توصل له؟</h1>
        <p className="muted">
          Intro يبحث عن الأشخاص المناسبين، يفهم ليش تحتاجهم، ويساعدك تبدأ التواصل معهم.
        </p>

        {/* A GET form, so the sentence survives the trip through sign-in as a
            query parameter rather than being lost with an unposted body. */}
        <form action="/new" method="get" className="hero-form">
          <input
            type="text"
            name="q"
            aria-label="وش تبغى تحقق؟"
            placeholder="مثال: أبي أوصل لمسؤولي الابتكار في البنوك السعودية"
          />
          <button type="submit" className="btn-primary" aria-label="ابدأ">
            ←
          </button>
        </form>

        <div className="row g10 wrapx" style={{ justifyContent: "center" }}>
          {GOALS.map((goal) => (
            <Link key={goal.label} href={`/new?q=${encodeURIComponent(goal.seed)}`} className="btn btn-sm">
              {goal.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="band" id="how">
        <div className="landing-wrap stack g26">
          <div className="stack g8" style={{ textAlign: "center" }}>
            <h2>مو قائمة أسماء.</h2>
            <p className="muted">Intro يحاول يفهم من الشخص اللي فعلاً تحتاج توصله.</p>
          </div>

          <div className="tri">
            {TRANSLATIONS.map((t) => (
              <div className="tri-cell stack g12" key={t.ask}>
                <strong className="sm">«{t.ask}»</strong>
                <div className="stack g6">
                  {t.roles.map((role) => (
                    <span className="sm lat" style={{ color: "var(--accent)" }} key={role}>
                      {role} ←
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <span className="sm dim" style={{ textAlign: "center" }}>
            بدل: ١٣٬٢٩١ جهة اتصال في قطاع البنوك.
          </span>
        </div>
      </section>

      <section className="landing-wrap steps-3">
        {STEPS.map((step) => (
          <div className="stack g8" key={step.n}>
            <span className="xs dim lat">{step.n}</span>
            <strong>{step.title}</strong>
            <span className="sm muted">{step.body}</span>
          </div>
        ))}
      </section>

      <section className="band" id="example">
        <div className="landing-wrap stack g20">
          <div className="stack g6">
            <span className="eyebrow">طلب</span>
            <h2>«أدور وظيفة قيادية في الـ Product في شركات تقنية سعودية.»</h2>
          </div>
          <div className="tri">
            {SAMPLE.map((person) => (
              <div className="card stack g8" key={person.latin}>
                <span className="xs dim lat">{person.latin}</span>
                <strong className="sm">{person.title}</strong>
                <span className="sm muted">{person.company}</span>
                <span className="row g6">
                  <span className="dot" style={{ background: person.dot }} />
                  <span className="sm" style={{ color: person.tone }}>
                    {person.fit}
                  </span>
                </span>
                <span className="sm muted">{person.why}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="hero">
        <h2>من ودك تعرف؟</h2>
        <Link href="/new" className="btn btn-primary">
          ابدأ مع Intro ←
        </Link>
      </section>

      <footer className="landing-wrap row between sm dim" style={{ paddingBottom: 40 }}>
        <span className="lat">intro.sa</span>
        <span>الرياض</span>
      </footer>
    </div>
  );
}

const GOALS = [
  { label: "أبحث عن عمل", seed: "أدور وظيفة قيادية في الـ Product في شركات تقنية سعودية." },
  { label: "أبحث عن عملاء", seed: "أبي أبيع منصة مدفوعات للبنوك — مين المسؤول عن Open Banking؟" },
  { label: "أبحث عن شريك", seed: "أبي أوصل للشخص المسؤول عن الشراكات في شركات التأمين." },
];

const TRANSLATIONS = [
  { ask: "أبي أبيع للبنوك", roles: ["Head of Open Banking", "VP Digital Partnerships", "Head of Fintech"] },
  { ask: "أدور وظيفة في الـ Product", roles: ["VP Product", "Director of Product", "Head of Talent, Tech"] },
  { ask: "أبحث عن مستثمر", roles: ["Principal, Early Stage", "Head of Investments", "Angel · ex-operator"] },
];

const STEPS = [
  { n: "01", title: "قل لنا وش تحتاج", body: "بيع، وظيفة، شراكة، استثمار أو شخص محدد." },
  { n: "02", title: "Intro يبحث", body: "عن الشركات والأشخاص الأقرب لهدفك." },
  { n: "03", title: "ابدأ التواصل", body: "اعرف ليش الشخص مناسب وكيف تبدأ معه." },
];

const SAMPLE = [
  {
    latin: "NOURA A.", title: "مديرة المنتج", company: "منصة مدفوعات · الرياض",
    fit: "توافق قوي", tone: "var(--accent)", dot: "#4F6B4C",
    why: "تبني فريق منتج جديد وتوظف مباشرة لأدوار قيادية.",
  },
  {
    latin: "FAISAL D.", title: "نائب رئيس المنتج", company: "شركة لوجستيات · الرياض",
    fit: "يستحق التجربة", tone: "var(--ink-2)", dot: "#C9C9C2",
    why: "أعلن عن توسع في فريق المنتج خلال الربع الحالي.",
  },
  {
    latin: "ABDULLAH H.", title: "رئيس التوظيف التقني", company: "مجموعة تقنية · جدة",
    fit: "احتمال توافق", tone: "var(--ink-2)", dot: "#E0E0DA",
    why: "يملك صورة كاملة عن الأدوار المفتوحة قبل نشرها.",
  },
];
