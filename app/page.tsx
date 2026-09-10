import Link from "next/link";
import { Wordmark } from "@/components/Chrome";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * The one address a concierge enquiry reaches. It is the only place the address
 * appears, so changing it here changes it everywhere. Door 2 of the page is
 * nothing but a mailto, deliberately: the first retainer clients are handled
 * by a person and an inbox, not by a table nobody has built yet.
 */
const CONCIERGE_EMAIL = "fm@mvp.sa";

type Lang = "ar" | "en";

/**
 * Both languages, one structure.
 *
 * The EN toggle used to be a disabled label because there was no second content
 * tree behind it. There is one now, and it lives here rather than in two page
 * components so a copy change cannot land in one language and silently skip the
 * other. The page reads `?lang=en` on the server and renders the matching tree,
 * so the toggle stays a <Link> and the landing still ships no JavaScript.
 */
const COPY = {
  ar: {
    dir: "rtl" as const,
    nav: { solutions: "حالات الاستخدام", how: "كيف نعمل", mine: "طلباتي", signin: "تسجيل الدخول", start: "ابدأ الآن", newReq: "طلب جديد" },
    pill: "من الرياض · للسوق السعودي",
    h1: "تواصل مع متخذ القرار — بالاسم، وفي وقته.",
    sub: "أخبرنا بما تحتاجه، ونعود إليك بأسماء محددة في السوق السعودي. مع كل اسم سببٌ موثّق بمصدره، ورسالة أولى مكتوبة له وحده، وطريق واضح للوصول: مباشرةً، أو عبر تعارف بموافقته.",
    placeholder: "مثال: أبحث عن مسؤولي الابتكار في البنوك السعودية",
    cta: "ابدأ ←",
    checks: ["أسباب لا قوائم", "تعارف بموافقة الطرفين", "حد يومي ١٠ رسائل"],
    coverage: "القطاعات التي نغطيها",
    povEyebrow: "وجهة نظرنا",
    povTitle: "لماذا لا يُجدي التواصل البارد في هذا السوق؟",
    pov: [
      { t: "الرسالة الموجّهة إلى مسمّى وظيفي لا تصل إلى إنسان.", b: "نسبة الرد على التواصل البارد تتراوح بين ١٪ و٢٪. والسبب ليس في الصياغة، بل في أن الرسالة كُتبت إلى «مدير التقنية»، لا إلى شخصٍ تعرف ما الذي يشغله هذا الربع." },
      { t: "قواعد البيانات العالمية لا تعرف هذا السوق.", b: "مسمّيات ناقصة، وبيانات شركات قديمة، وأسماء عربية لا تُطابَق بشكل صحيح. ما ينفع هنا يُبنى بالبحث، اسمًا اسمًا." },
      { t: "القيمة في السبب، لا في طول القائمة.", b: "الحصول على ألف اسم سهل. نحن نعطيك عشرين اسمًا، مع كل واحد مصدر مؤرّخ يوضّح لماذا هو تحديدًا، ولماذا الآن. وأي اسم بلا مصدر لا يُنشر." },
      { t: "الموافقة تبني علاقة، والإرسال العشوائي يحرق السمعة.", b: "حد يومي ثابت، ورسالة واحدة لكل شخص، وقائمة استبعاد تُحترم لدى جميع العملاء. سمعتك هي الأصل الذي لا يُشترى مرة أخرى." },
    ],
    howEyebrow: "كيف نعمل",
    howTitle: "خمسة مخرجات، في كل قطاع.",
    how: [
      { t: "خريطة القطاع", b: "من يتخذ القرار فعليًا، ومن يؤثر فيه. الهيكل التنظيمي وحده لا يكفي لمعرفة ذلك." },
      { t: "عشرون اسمًا محددًا", b: "أشخاص حقيقيون، مع كل اسم مصدر مؤرّخ." },
      { t: "السبب", b: "لماذا هو، ولماذا الآن — بصياغة جاهزة للإرسال." },
      { t: "الرسالة الأولى", b: "مكتوبة لكل شخص على حدة، بالعربية أو الإنجليزية. وليست رسالة واحدة تُعمَّم." },
      { t: "طريق الوصول", b: "مباشرةً، أو بتعارف بموافقة الطرفين، أو عبر شريك له علاقة قائمة بالجهة." },
    ],
    useEyebrow: "حالات الاستخدام",
    useTitle: "محرك واحد. ستة مسارات للدخول.",
    concierge: {
      eyebrow: "الخدمة المُدارة",
      title: "تحتاج فريقًا، لا قائمة؟",
      body: "بعض الشركات لا تحتاج اسمًا واحدًا، بل وظيفة تطوير أعمال كاملة لم توظّفها بعد. نعمل معك باشتراك شهري: خريطة القطاع، والأسماء، والاجتماعات، وتقرير أسبوعي.",
      mail: "راسلنا",
      file: "أو ابدأ طلبًا الآن",
      seed: "أبي أدخل السوق السعودي وأحتاج فريق يفتح لي أول ٢٠ اجتماع مع أصحاب القرار في قطاعي.",
      note: "نرد خلال يوم عمل واحد.",
    },
    ctaTitle: "جرّبنا على هدف حقيقي.",
    ctaBody: "اختر هدفًا واحدًا — حسابًا تريد الدخول إليه، أو سوقًا تريد قراءته، أو دورًا لم تتمكن من شغله. ونشتغل عليه أمامك مباشرة.",
    ctaChecks: ["جولة ٣٠ دقيقة على طلبك", "بالعربية أو الإنجليزية", "بدعوة فقط خلال فترة الإطلاق"],
    ctaPick: "ما الذي تحتاجه؟",
    ctaStart: "ابدأ طلبك ←",
    footTag: "من الرياض. Intro يجد الأشخاص الذين يحرّكون أعمالك، ويفتح الباب — بموافقتهم.",
    footCols: ["المنتج", "حالات الاستخدام", "الشركة"],
  },
  en: {
    dir: "ltr" as const,
    nav: { solutions: "Use cases", how: "How it works", mine: "My requests", signin: "Sign in", start: "Get started", newReq: "New request" },
    pill: "From Riyadh · Built for Saudi",
    h1: "Reach the person who decides — by name, and why now.",
    sub: "Tell us what you need. You get named people in the Saudi market, each carrying sourced evidence, a first message written for them, and a way in: direct, or a consented introduction.",
    placeholder: "e.g. I need to reach innovation leads at Saudi banks",
    cta: "Start →",
    checks: ["Reasons, not lists", "Consented introductions", "A hard daily cap of 10"],
    coverage: "Sector coverage",
    povEyebrow: "Our perspective",
    povTitle: "Why cold outreach doesn't work here.",
    pov: [
      { t: "Cold outreach fails because it is addressed to a job title, not a person.", b: "A 1–2% reply rate is not a copywriting problem. It is what happens when you write to “the Head of IT” instead of to someone whose actual quarter you understand." },
      { t: "The global data layer does not know this market.", b: "Thin titles, stale companies, Arabic names that never resolve. What works here is built by research, one person at a time." },
      { t: "A list is not the product. The reason is.", b: "Anyone can hand you a thousand names. You get twenty, each carrying a dated source explaining why them and why now. A row with no evidence never ships." },
      { t: "Consent compounds. Volume burns.", b: "A fixed daily cap, one message per person, and a suppression list honoured across every client. Your reputation is the one asset you cannot buy back." },
    ],
    howEyebrow: "How it works",
    howTitle: "Five outputs, in every sector.",
    how: [
      { t: "The map", b: "Who actually decides in this sector, and who moves them. The org chart usually lies about which one matters." },
      { t: "The named twenty", b: "Real people, each with dated, sourced evidence." },
      { t: "The reason", b: "Why them, why now — in a form you can send as it stands." },
      { t: "The opener", b: "Written per person, in Arabic or English. Never one body fanned out." },
      { t: "The path", b: "Direct, a consented introduction, or through a partner already inside the account." },
    ],
    useEyebrow: "Use cases",
    useTitle: "One engine. Six ways in.",
    concierge: {
      eyebrow: "Managed service",
      title: "Need a team, not a list?",
      body: "Some companies don't need one name — they need an entire go-to-market function they haven't hired yet. We work monthly: the map, the names, the meetings, and a weekly report.",
      mail: "Email us",
      file: "Or start a request now",
      seed: "We are entering the Saudi market and need a team to open our first 20 meetings with decision-makers in our sector.",
      note: "We reply within one business day. The request form is in Arabic — email is the faster route in English.",
    },
    ctaTitle: "Try it on your own goal.",
    ctaBody: "Bring one real objective — an account you want inside, a market you need to read, or a role you couldn't fill. We'll run it in front of you.",
    ctaChecks: ["A 30-minute walkthrough of your request", "In Arabic or English", "Invite-only during launch"],
    ctaPick: "What do you need?",
    ctaStart: "Start your request →",
    footTag: "Built in Riyadh. Intro finds the people who move your business and opens the door — with their consent.",
    footCols: ["Product", "Use cases", "Company"],
  },
};

const GOALS = {
  ar: [
    { label: "أبحث عن عملاء", seed: "أبي أبيع منصة مدفوعات للبنوك — مين المسؤول عن Open Banking؟" },
    { label: "أبحث عن شريك", seed: "أبي أوصل للشخص المسؤول عن الشراكات في شركات التأمين." },
    { label: "أبحث عن قيادات", seed: "أدور وظيفة قيادية في الـ Product في شركات تقنية سعودية." },
  ],
  en: [
    { label: "Looking for customers", seed: "أبي أبيع منصة مدفوعات للبنوك — مين المسؤول عن Open Banking؟" },
    { label: "Looking for a partner", seed: "أبي أوصل للشخص المسؤول عن الشراكات في شركات التأمين." },
    { label: "Looking for a leader to hire", seed: "أدور وظيفة قيادية في الـ Product في شركات تقنية سعودية." },
  ],
};

const SECTORS = {
  ar: ["البنوك والتقنية المالية", "التأمين", "القطاع العام والمشاريع الكبرى", "الطاقة واللوجستيات", "الصحة", "تقنية المؤسسات"],
  en: ["Banking & fintech", "Insurance", "Public sector & giga-projects", "Energy & logistics", "Health", "Enterprise tech"],
};

/** The six products as use cases. `lead` marks the one the page argues hardest for. */
const USE_CASES = {
  ar: [
    { n: "01", label: "دخول السوق", title: "أول ٢٠ اجتماعًا لك في السعودية", body: "لديك ترخيص الاستثمار والمقر الإقليمي، وينقصك الوصول. نبني خريطة القطاع والأسماء والاجتماعات خلال ٩٠ يومًا — قبل أن توظّف فريقًا كاملًا.", pain: "ستة أشهر حتى أول صفقة", lead: true },
    { n: "02", label: "المال المنظّم", title: "البنوك والتقنية المالية والتأمين", body: "لجنة الشراء في البنك السعودي تتكوّن من أربعة أشخاص، وأدوات البيانات العالمية لا تعرف أيًّا منهم. القطاع محدود العدد، وهذا ما يجعل تغطيته بالكامل ممكنة.", pain: "البيع لمسمّى وظيفي بدل لجنة", lead: false },
    { n: "03", label: "القطاع العام", title: "اعرف صاحب البرنامج قبل الكراسة", body: "حين تُطرح المنافسة في «اعتماد» تكون الملامح قد اكتملت غالبًا. نصل بك مبكرًا إلى مالك البرنامج، والمقيّم الفني، والمسؤول عن المحتوى المحلي.", pain: "معرفة المنافسة بعد فوات وقت التأثير", lead: false },
    { n: "04", label: "القنوات والشركاء", title: "ثلاثة مكاملين، لا مئتان", body: "إن لم يكن البيع المباشر خيارًا، فأنت تحتاج الشريك الذي له علاقة قائمة بالجهة — مرتَّبًا حسب أعمال نفّذها فعلًا، لا حسب صفحة شركاء.", pain: "شراكات على الورق", lead: false },
    { n: "05", label: "بناء الفريق", title: "من نفّذ العمل لا يتقدّم على إعلانك", body: "نحدد الممارسين الذين بنوا المسار نفسه في شركات مماثلة، ونرتب تعارفًا بموافقتهم. وصول، لا وساطة توظيف.", pain: "٢٥٪ عمولة مقابل سيرة ذاتية", lead: false },
    { n: "06", label: "الرادار", title: "إشارة تنتهي باسم", body: "تغييرات قيادية، وبرامج جديدة، وتحديثات تنظيمية، وميزانيات — مرتبطة بأشخاص يمكن الوصول إليهم. موجز شهري لكل قطاع.", pain: "تحليل لا ينتهي باسم", lead: false },
  ],
  en: [
    { n: "01", label: "Market entry", title: "Your first 20 meetings in Saudi", body: "You have the licence and the regional HQ. You don't have the network. We build the map, the names and the meetings in 90 days — before you hire a full team.", pain: "Six months to a first deal", lead: true },
    { n: "02", label: "Regulated money", title: "Banks, fintech and insurance", body: "A buying committee at a Saudi bank is four people, and the global tools know none of them. The universe is small enough to cover completely.", pain: "Selling to a title, not a committee", lead: false },
    { n: "03", label: "Public sector", title: "Know the programme owner before the RFP", body: "By the time a tender is published, the decision is usually made. We name the programme owner, the technical evaluator and the local-content stakeholder early.", pain: "Hearing about it too late", lead: false },
    { n: "04", label: "Channel & partners", title: "Three integrators, not two hundred", body: "If you can't sell direct, you need the partner already inside the account — ranked by work actually delivered, not by a partner-page listing.", pain: "Paper partnerships", lead: false },
    { n: "05", label: "Building the team", title: "The person who did the work isn't answering your job post", body: "We identify practitioners who built this exact motion at comparable companies and arrange a consented introduction. Access, not placement.", pain: "25% for a forwarded CV", lead: false },
    { n: "06", label: "Radar", title: "Signal that names a person", body: "Leadership moves, new programmes, regulation, budgets — tied to people you can actually reach. A monthly brief per sector.", pain: "Analysis that never names anyone", lead: false },
  ],
};

const MATCHES = {
  ar: {
    req: "البيع لشركات التأمين السعودية",
    status: "جارٍ المطابقة",
    rows: [
      { title: "مدير الشراكات الرقمية", why: "أطلق برنامج توزيع في الربع الثاني", fit: "توافق قوي", pending: false },
      { title: "نائب رئيس الابتكار", why: "يدير ميزانية التجارب مع المزوّدين", fit: "توافق قوي", pending: false },
      { title: "مدير التأمين المصرفي", why: "متاح للتعارف عبر Intro", fit: "عبر Intro", pending: false },
      { title: "الرئيس التنفيذي للتوزيع", why: "قيد البحث", fit: "جارٍ", pending: true },
    ],
  },
  en: {
    req: "Selling into Saudi insurers",
    status: "Matching",
    rows: [
      { title: "Head of Digital Partnerships", why: "Launched a distribution programme in Q2", fit: "Strong fit", pending: false },
      { title: "VP of Innovation", why: "Owns the vendor pilot budget", fit: "Strong fit", pending: false },
      { title: "Bancassurance Director", why: "Open to an introduction via Intro", fit: "Via Intro", pending: false },
      { title: "Chief Distribution Officer", why: "Being researched", fit: "In progress", pending: true },
    ],
  },
};

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const session = await auth();
  const signedIn = Boolean(session?.user);
  const { lang: raw } = await searchParams;
  const lang: Lang = raw === "en" ? "en" : "ar";
  const t = COPY[lang];
  const goals = GOALS[lang];
  const other = lang === "ar" ? "/?lang=en" : "/";

  return (
    /* dir and lang sit here, not on <html>: the root layout is shared with every
       signed-in screen, and none of those have an English tree. The stylesheet
       uses no physical left/right properties, so the whole landing mirrors from
       this one attribute. */
    <div className="landing" dir={t.dir} lang={lang}>
      <header className="nav">
        <div className="row g16 wrapx" style={{ gap: 48 }}>
          <Link href={lang === "ar" ? "/" : "/?lang=en"} className="logo">
            <Wordmark />
          </Link>
          <nav className="nav-links">
            <a href="#use-cases">{t.nav.solutions}</a>
            <a href="#how">{t.nav.how}</a>
            {signedIn && <Link href="/requests">{t.nav.mine}</Link>}
          </nav>
        </div>
        <div className="row g16 wrapx">
          {/* A real toggle now: a link to the same page in the other language.
              No JavaScript, and no state for the next screen to be told about. */}
          <div className="seg" aria-label={lang === "ar" ? "لغة الواجهة" : "Interface language"}>
            {lang === "en" ? (
              <span className="lat on" aria-current="true">EN</span>
            ) : (
              <Link href={other} className="lat">EN</Link>
            )}
            {lang === "ar" ? (
              <span className="on" aria-current="true">عربي</span>
            ) : (
              <Link href={other}>عربي</Link>
            )}
          </div>
          {!signedIn && (
            <Link href="/login" className="sm" style={{ color: "var(--ink-2)", fontWeight: 500 }}>
              {t.nav.signin}
            </Link>
          )}
          <Link href="/new" className="btn btn-primary btn-sm">
            {signedIn ? t.nav.newReq : t.nav.start}
          </Link>
        </div>
      </header>

      <div className="landing-wrap">
        <section className="hero">
          <div className="stack g20">
            <span className="pill-accent">{t.pill}</span>
            <h1>{t.h1}</h1>
            <p>{t.sub}</p>

            {/* Door 1, unchanged. It GETs to /new?q=… and middleware.ts carries
                pathname + search into `next`, so a sentence typed by a signed-out
                visitor survives the sign-in detour and arrives prefilled. */}
            <form action="/new" method="get" className="hero-form">
              <input type="text" name="q" aria-label={t.placeholder} placeholder={t.placeholder} />
              <button type="submit" className="btn-primary">{t.cta}</button>
            </form>

            <div className="row g10 wrapx">
              {goals.map((goal) => (
                <Link key={goal.label} href={`/new?q=${encodeURIComponent(goal.seed)}`} className="btn btn-sm">
                  {goal.label}
                </Link>
              ))}
            </div>

            <div className="checks">
              {t.checks.map((c) => (<span key={c}>✓ {c}</span>))}
            </div>
          </div>

          <MatchingPanel lang={lang} />
        </section>
      </div>

      {/* Sectors we cover — not customers we have. The previous wording
          («مستخدم للوصول إلى» — "used to reach") implied a client base. */}
      <section className="strip">
        <div className="landing-wrap strip-inner">
          <span className="eyebrow" style={{ flex: "none" }}>{t.coverage}</span>
          {SECTORS[lang].map((s) => (<span className="sm muted" key={s}>{s}</span>))}
        </div>
      </section>

      <section className="section landing-wrap" id="perspective">
        <div className="stack g8" style={{ marginBottom: 44 }}>
          <span className="eyebrow">{t.povEyebrow}</span>
          <h2 style={{ fontSize: "var(--text-3xl)" }}>{t.povTitle}</h2>
        </div>
        <div className="pov-grid">
          {t.pov.map((p, i) => (
            <div className="pov-cell stack g10" key={p.t}>
              <span className="pov-n lat">{String(i + 1).padStart(2, "0")}</span>
              <strong style={{ fontSize: "var(--text-lg)", lineHeight: 1.5 }}>{p.t}</strong>
              <p className="sm muted">{p.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="on-ink section" id="how">
        <div className="landing-wrap dark-grid">
          <div className="stack g16">
            <span className="eyebrow">{t.howEyebrow}</span>
            <h2 style={{ fontSize: "var(--text-3xl)" }}>{t.howTitle}</h2>
            <p className="muted">{t.sub}</p>
          </div>
          <div className="spine">
            {t.how.map((s, i) => (
              <div className="spine-row" key={s.t}>
                <span className="spine-n lat">{i + 1}</span>
                <span className="stack g4">
                  <strong>{s.t}</strong>
                  <span className="sm muted">{s.b}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section landing-wrap" id="use-cases">
        <div className="stack g8" style={{ marginBottom: 44 }}>
          <span className="eyebrow">{t.useEyebrow}</span>
          <h2 style={{ fontSize: "var(--text-3xl)" }}>{t.useTitle}</h2>
        </div>
        <div className="dir-grid">
          {USE_CASES[lang].map((u) => (
            <div className={`dir-cell stack g12${u.lead ? " lead" : ""}`} key={u.n}>
              <span className="dir-kicker">
                <span className="lat">{u.n}</span> — {u.label}
              </span>
              <strong style={{ fontSize: "var(--text-lg)" }}>{u.title}</strong>
              <p className="sm muted">{u.body}</p>
              <span className="dir-pain">{lang === "ar" ? "التحدي: " : "The pain: "}{u.pain}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Door 2. A mailto and a seeded request — no new route, no new table.
          In English the mail route is listed first: everything past /new is
          Arabic-only, so a person is the faster path for an English visitor. */}
      <section className="cta-band" id="concierge">
        <div className="landing-wrap cta-grid">
          <div className="stack g16">
            <span className="eyebrow">{t.concierge.eyebrow}</span>
            <h2 style={{ fontSize: "var(--text-3xl)" }}>{t.concierge.title}</h2>
            <p className="muted">{t.concierge.body}</p>
          </div>
          <div className="card stack g16">
            <a href={`mailto:${CONCIERGE_EMAIL}`} className="btn btn-primary" style={{ width: "100%" }}>
              {t.concierge.mail}
            </a>
            <Link href={`/new?q=${encodeURIComponent(t.concierge.seed)}`} className="btn" style={{ width: "100%" }}>
              {t.concierge.file}
            </Link>
            <span className="sm dim">{t.concierge.note}</span>
          </div>
        </div>
      </section>

      <section className="section landing-wrap">
        <div className="cta-grid">
          <div className="stack g16">
            <h2 style={{ fontSize: "var(--text-3xl)" }}>{t.ctaTitle}</h2>
            <p className="muted">{t.ctaBody}</p>
            <div className="stack g8 sm muted">
              {t.ctaChecks.map((c) => (<span key={c}>✓ {c}</span>))}
            </div>
          </div>
          <div className="card stack g16">
            <span className="eyebrow">{t.ctaPick}</span>
            <div className="row g8 wrapx">
              {goals.map((goal) => (
                <Link key={goal.label} href={`/new?q=${encodeURIComponent(goal.seed)}`} className="btn btn-sm">
                  {goal.label}
                </Link>
              ))}
            </div>
            <Link href="/new" className="btn btn-primary" style={{ width: "100%" }}>
              {t.ctaStart}
            </Link>
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="landing-wrap">
          <div className="foot-grid">
            <div className="stack g14">
              <Wordmark on="ink" size="lg" />
              <p className="sm" style={{ maxWidth: "40ch" }}>{t.footTag}</p>
            </div>
            <div className="stack g10">
              <span className="eyebrow" style={{ color: "var(--on-dark-2)" }}>{t.footCols[0]}</span>
              <Link href="/requests">{t.nav.mine}</Link>
              <Link href="/new">{t.nav.newReq}</Link>
            </div>
            <div className="stack g10">
              <span className="eyebrow" style={{ color: "var(--on-dark-2)" }}>{t.footCols[1]}</span>
              {USE_CASES[lang].slice(0, 3).map((u) => (
                <a href="#use-cases" key={u.n}>{u.label}</a>
              ))}
            </div>
            <div className="stack g10">
              <span className="eyebrow" style={{ color: "var(--on-dark-2)" }}>{t.footCols[2]}</span>
              <Link href="/login">{t.nav.signin}</Link>
              <a href={`mailto:${CONCIERGE_EMAIL}`}>{t.concierge.mail}</a>
              <Link href={other}>{lang === "ar" ? "English" : "عربي"}</Link>
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

/**
 * The artboard's live matching panel — the page's strongest element, because it
 * shows the product's actual claim (a reason attached to every name) before any
 * copy argues for it. Static: this is a picture of the product, not the product.
 */
function MatchingPanel({ lang }: { lang: Lang }) {
  const m = MATCHES[lang];
  return (
    <div className="panel" aria-label={lang === "ar" ? "مثال على قائمة ترشيحات" : "Example candidate list"}>
      <div className="panel-head">
        <span className="sm">
          <span className="dim">{lang === "ar" ? "طلب · " : "Request · "}</span>
          <strong>{m.req}</strong>
        </span>
        <span className="badge accent">{m.status}</span>
      </div>
      {m.rows.map((r) => (
        <div className="panel-row" key={r.title}>
          <span className={`tick${r.pending ? " idle" : ""}`}>{r.pending ? "?" : "✓"}</span>
          <span className="stack g4 grow">
            <strong className="sm">{r.title}</strong>
            <span className="xs muted">{r.why}</span>
          </span>
          <span className="xs" style={{ color: r.pending ? "var(--ink-3)" : "var(--accent)" }}>
            {r.fit}
          </span>
        </div>
      ))}
    </div>
  );
}
