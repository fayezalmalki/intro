import Link from "next/link";
import { Wordmark } from "@/components/Chrome";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * The public landing, rebuilt to the B2B artboard in the design handoff.
 *
 * Deliberately unauthenticated, and deliberately a server component: every
 * piece of state the artboard carries — the language toggle, the chip picker —
 * is expressible as a link or a static control here, so the page ships no
 * JavaScript and still works with none.
 */
export default async function LandingPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  return (
    <div className="landing">
      <header className="nav">
        <div className="row g16 wrapx" style={{ gap: 48 }}>
          <Link href="/" className="logo">
            <Wordmark />
          </Link>
          <nav className="nav-links">
            <a href="#directions">الحلول</a>
            <a href="#product">المنتج</a>
            {signedIn && <Link href="/requests">طلباتي</Link>}
          </nav>
        </div>
        <div className="row g16 wrapx">
          {/* Arabic is the product. English is shown as a destination that
              exists in the brand, not as a control that would do nothing —
              a live toggle with no second content tree behind it is worse
              than one that says plainly where it stands. */}
          <div className="seg" aria-label="لغة الواجهة">
            {/* .lat sits on the Latin label only. On the wrapper it would put
                Space Grotesk — which has no Arabic glyphs — on «عربي» too. */}
            <span className="lat" aria-disabled="true" title="النسخة الإنجليزية قريبًا">
              EN
            </span>
            <span className="on" aria-current="true">عربي</span>
          </div>
          {!signedIn && (
            <Link href="/login" className="sm" style={{ color: "var(--ink-2)", fontWeight: 500 }}>
              تسجيل الدخول
            </Link>
          )}
          <Link href="/new" className="btn btn-primary btn-sm">
            {signedIn ? "طلب جديد" : "ابدأ الآن"}
          </Link>
        </div>
      </header>

      <div className="landing-wrap">
        <section className="hero">
          <div className="stack g20">
            <span className="pill-accent">من الرياض · عربي أولاً</span>
            <h1>اوصل للأشخاص اللي يحركون شغلك.</h1>
            <p>
              قل لـ Intro وش تحتاج — عميل، شريك، أو موظف قيادي. يلقى لك الأشخاص المناسبين
              في السوق السعودي، يشرح ليش كل واحد منهم مهم، ويفتح الباب: مباشرة أو عبر
              تعارف بموافقة الطرفين.
            </p>

            {/* The artboard puts two buttons here. This is a form instead, and
                that is not a liberty: it GETs to /new?q=…, and middleware.ts
                carries pathname + search into `next`, so a sentence typed by a
                signed-out visitor survives the sign-in detour and arrives
                prefilled. Replacing it with a CTA would quietly delete the
                product's front door. */}
            <form action="/new" method="get" className="hero-form">
              <input
                type="text"
                name="q"
                aria-label="مين ودك توصل له؟"
                placeholder="مثال: أبي أوصل لمسؤولي الابتكار في البنوك السعودية"
              />
              <button type="submit" className="btn-primary">
                ابدأ ←
              </button>
            </form>

            <div className="row g10 wrapx">
              {GOALS.map((goal) => (
                <Link
                  key={goal.label}
                  href={`/new?q=${encodeURIComponent(goal.seed)}`}
                  className="btn btn-sm"
                >
                  {goal.label}
                </Link>
              ))}
            </div>

            <div className="checks">
              {["أسباب، مو قوائم", "تعارف بموافقة الطرفين", "حد يومي ١٠ رسائل"].map((c) => (
                <span key={c}>✓ {c}</span>
              ))}
            </div>
          </div>

          <MatchingPanel />
        </section>
      </div>

      <section className="strip">
        <div className="landing-wrap strip-inner">
          <span className="eyebrow" style={{ flex: "none" }}>
            مستخدم للوصول إلى
          </span>
          {SECTORS.map((sector) => (
            <span className="sm muted" key={sector}>
              {sector}
            </span>
          ))}
        </div>
      </section>

      <section className="section landing-wrap" id="directions">
        <div className="stack g8" style={{ marginBottom: 44 }}>
          <span className="eyebrow">ثلاث طرق للدخول</span>
          <h2 style={{ fontSize: "var(--text-3xl)" }}>محرك واحد. ثلاث مشاكل يحلها.</h2>
        </div>
        <div className="dir-grid">
          {DIRECTIONS.map((d) => (
            <div className="dir-cell stack g12" key={d.n}>
              <span className="dir-kicker">
                <span className="lat">{d.n}</span> — {d.label}
              </span>
              <strong style={{ fontSize: "var(--text-lg)" }}>{d.title}</strong>
              <p className="sm muted">{d.body}</p>
              <span className="dir-pain">الوجع: {d.pain}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="on-ink section" id="product">
        <div className="landing-wrap dark-grid">
          <div className="stack g16">
            <span className="eyebrow">داخل المنتج</span>
            <h2 style={{ fontSize: "var(--text-3xl)" }}>سبب، مو كومة جهات اتصال.</h2>
            <p className="muted">
              كل ترشيح شخص ومعه قضية: ليش هو، وليش الحين، وكيف تبدأ. وإذا كان متاحًا
              للتعارف، Intro يسأله أولًا — عشان ما تحرق الحساب برسالة باردة.
            </p>
            <div className="stack g10">
              {PROOFS.map((proof) => (
                <span className="row g10 sm" key={proof}>
                  <span className="tick" style={{ width: 20, height: 20 }}>
                    ✓
                  </span>
                  <span className="muted">{proof}</span>
                </span>
              ))}
            </div>
          </div>

          <MatchBrief />
        </div>
      </section>

      <section className="cta-band">
        <div className="landing-wrap cta-grid">
          <div className="stack g16">
            <h2 style={{ fontSize: "var(--text-3xl)" }}>جرّبه على هدفك أنت.</h2>
            <p className="muted">
              جِب هدفًا واحدًا حقيقيًا — حساب تبي تدخله، سوق تقرأه، أو دور ما قدرت
              تعبّيه. نشغّله قدامك مباشرة.
            </p>
            <div className="stack g8 sm muted">
              {["جولة ٣٠ دقيقة على طلبك", "بالعربي أو بالإنجليزي", "بدعوة فقط خلال الإطلاق"].map((c) => (
                <span key={c}>✓ {c}</span>
              ))}
            </div>
          </div>

          <div className="card stack g16">
            <span className="eyebrow">وش تحتاج؟</span>
            {/* Links, not a client-side picker. Each chip carries a seed
                sentence into /new through the same ?q= mechanic as the hero,
                so choosing one starts a real request rather than setting a
                state the next screen would have to be told about. */}
            <div className="row g8 wrapx">
              {GOALS.map((goal) => (
                <Link
                  key={goal.label}
                  href={`/new?q=${encodeURIComponent(goal.seed)}`}
                  className="btn btn-sm"
                >
                  {goal.label}
                </Link>
              ))}
            </div>
            <Link href="/new" className="btn btn-primary" style={{ width: "100%" }}>
              ابدأ طلبك ←
            </Link>
            <span className="sm dim">نرد خلال يوم عمل واحد.</span>
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="landing-wrap">
          <div className="foot-grid">
            <div className="stack g14">
              <Wordmark on="ink" size="lg" />
              <p className="sm" style={{ maxWidth: "40ch" }}>
                مبني في الرياض. Intro يلقى الأشخاص اللي يحركون شغلك ويفتح الباب —
                بموافقتهم.
              </p>
            </div>
            {FOOTER.map((col) => (
              <div className="stack g10" key={col.title}>
                <span className="eyebrow" style={{ color: "var(--on-dark-2)" }}>
                  {col.title}
                </span>
                {col.links.map((l) => (
                  <Link href={l.href} key={l.label}>
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
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

/**
 * The artboard's live matching panel — the page's strongest element, because it
 * shows the product's actual claim (a reason attached to every name) before any
 * copy argues for it. Static: this is a picture of the product, not the product.
 */
function MatchingPanel() {
  return (
    <div className="panel" aria-label="مثال على قائمة ترشيحات">
      <div className="panel-head">
        <span className="sm">
          <span className="dim">طلب · </span>
          <strong>البيع لشركات التأمين السعودية</strong>
        </span>
        <span className="badge accent">جارٍ المطابقة</span>
      </div>
      {MATCHES.map((m) => (
        <div className="panel-row" key={m.title}>
          <span className={`tick${m.pending ? " idle" : ""}`}>{m.pending ? "٤" : "✓"}</span>
          <span className="stack g4 grow">
            <strong className="sm">{m.title}</strong>
            <span className="xs muted">{m.why}</span>
          </span>
          <span className="xs" style={{ color: m.pending ? "var(--ink-3)" : "var(--accent)" }}>
            {m.fit}
          </span>
        </div>
      ))}
      <div className="panel-foot">
        <span className="xs muted">٨ من ١٠ — كل ترشيح معه سبب</span>
        <span className="xs" style={{ color: "var(--accent)", fontWeight: 600 }}>
          راجع الترشيحات ←
        </span>
      </div>
    </div>
  );
}

/** The dark section's match brief, on the raised ink surface. */
function MatchBrief() {
  return (
    <div className="card stack g14">
      <div className="row between g12 wrapx">
        <span className="eyebrow lat">MATCH BRIEF · R-1204</span>
        <span className="xs" style={{ color: "var(--on-dark-2)" }}>
          حُدّث قبل ساعتين
        </span>
      </div>
      <div className="row between g12 wrapx">
        <strong style={{ fontSize: "var(--text-lg)" }}>مدير الشراكات الرقمية</strong>
        <span className="badge accent">توافق قوي</span>
      </div>
      <span className="sm" style={{ color: "var(--on-dark-2)" }}>
        شركة تأمين وطنية · الرياض · متاح للتعارف
      </span>
      <div className="stack" style={{ marginTop: 4 }}>
        {SCORES.map((s) => (
          <div className="brief-row" key={s.label}>
            <span className="sm" style={{ color: "var(--on-dark)" }}>
              {s.label}
            </span>
            <span className={`badge ${s.tone}`}>{s.verdict}</span>
          </div>
        ))}
      </div>
      <div className="row g10 wrapx" style={{ marginTop: 4 }}>
        <button type="button" className="btn btn-primary btn-sm">
          تواصل مباشرة
        </button>
        <button type="button" className="btn btn-sm">
          اطلب تعارف
        </button>
      </div>
    </div>
  );
}

const GOALS = [
  { label: "أبحث عن عملاء", seed: "أبي أبيع منصة مدفوعات للبنوك — مين المسؤول عن Open Banking؟" },
  { label: "أبحث عن شريك", seed: "أبي أوصل للشخص المسؤول عن الشراكات في شركات التأمين." },
  { label: "أبحث عن موظف قيادي", seed: "أدور وظيفة قيادية في الـ Product في شركات تقنية سعودية." },
];

const SECTORS = ["البنوك والتقنية المالية", "التأمين", "التجزئة واللوجستيات", "القطاع الحكومي", "الصحة", "تقنية المؤسسات"];

const MATCHES = [
  { title: "مدير الشراكات الرقمية", why: "أطلق برنامج توزيع في الربع الثاني", fit: "توافق قوي", pending: false },
  { title: "نائب رئيس الابتكار", why: "يملك ميزانية التجارب مع المزودين", fit: "توافق قوي", pending: false },
  { title: "مدير التأمين المصرفي", why: "متاح للتعارف عبر Intro", fit: "عبر Intro", pending: false },
  { title: "الرئيس التنفيذي للتوزيع", why: "قيد البحث", fit: "جارٍ", pending: true },
];

const DIRECTIONS = [
  {
    n: "01",
    label: "مبيعات وشراكات",
    title: "مسارات دافئة للحسابات",
    body: "التواصل البارد يجيب رد بنسبة ١–٢٪. Intro يلقى صاحب القرار الحقيقي في كل حساب، يقول لك ليش الحين هو الوقت المناسب، ويقدر يسأله أولًا — عشان يبدأ الحديث دافئًا.",
    pain: "خط مبيعات مبني على الرش والدعاء",
  },
  {
    n: "02",
    label: "قراءة السوق",
    title: "اعرف مين يتحرك، أول",
    body: "تغييرات القيادة، ميزانيات جديدة، توسّع، موجات توظيف — نتابعها في السوق السعودي ونربطها بطلباتك المفتوحة. الإشارة ما تنفع إلا إذا سمّت لك شخصًا تقدر توصله.",
    pain: "تسمع بالصفقة بعد ما تُقفل",
  },
  {
    n: "03",
    label: "وصول للقيادات",
    title: "اوصل للممارسين مباشرة",
    body: "أفضل التعيينات والمستشارين ما يقدّمون على وظائف. Intro يحدد مين اللي فعلًا سوّى الشغل، ويرتب تعارفًا بموافقته — بدون عمولة وكالة ولا رسالة LinkedIn باردة.",
    pain: "٢٥٪ عمولة مقابل سيرة ذاتية مُحوّلة",
  },
];

const PROOFS = [
  "الدور والشركة والتوقيت — كل واحد مقيَّم لكل ترشيح",
  "رسالة أولى مكتوبة ومبنية على إشارات حقيقية",
  "مسار تعارف بموافقة الطرفين لما المباشر ما ينفع",
];

const SCORES = [
  { label: "الدور — يملك ميزانية التوزيع عبر الشركاء", verdict: "قوي", tone: "accent" },
  { label: "الشركة — أعلنت توجهًا للقنوات الرقمية", verdict: "قوي", tone: "accent" },
  { label: "التوقيت — البرنامج انطلق والمزودون لم يُختاروا", verdict: "تحرّك الآن", tone: "warn" },
];

const FOOTER = [
  {
    title: "المنتج",
    links: [
      { label: "طلباتي", href: "/requests" },
      { label: "طلب جديد", href: "/new" },
    ],
  },
  {
    title: "الحلول",
    links: [
      { label: "مبيعات وشراكات", href: "#directions" },
      { label: "قراءة السوق", href: "#directions" },
      { label: "وصول للقيادات", href: "#directions" },
    ],
  },
  {
    title: "الشركة",
    links: [
      { label: "تسجيل الدخول", href: "/login" },
      { label: "الرياض", href: "#product" },
    ],
  },
];
