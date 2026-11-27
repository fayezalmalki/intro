import { Geist, Inter_Tight } from "next/font/google";
import { PACKAGES } from "@/lib/billing/packages";
import type { Pitch as PitchCopy } from "@/lib/site/pitch";
import { PitchSearch } from "./PitchSearch";
import { Container, Contour, Icon, PillLink, Wordmark, cx } from "./ui";
import "../../app/site.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-inter-tight", display: "swap" });

/**
 * The intro.sa landing, English (/) and Arabic (/ar) from one component and
 * the words in lib/site/pitch.ts. Every way in — the search box, "Start free",
 * a use-case example — goes through /start: account first, then the search
 * the visitor asked for runs on arrival.
 */
export function Pitch({ t, signedIn }: { t: PitchCopy; signedIn: boolean }) {
  return (
    <div lang={t.locale} dir={t.dir} data-dir={t.dir} className={`site ${geist.variable} ${interTight.variable} bg-white`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-white">{t.skip}</a>
      <Header t={t} signedIn={signedIn} />
      <main id="main">
        <Hero t={t} />
        <How t={t} />
        <Sample t={t} />
        <Uses t={t} />
        <Features t={t} />
        <Pricing t={t} />
        <Faq t={t} />
        <Close t={t} />
      </main>
      <Footer t={t} />
    </div>
  );
}

const start = (t: PitchCopy, extra: Record<string, string> = {}) => `/start?${new URLSearchParams({ lang: t.locale, ...extra })}`;

function Header({ t, signedIn }: { t: PitchCopy; signedIn: boolean }) {
  const n = t.nav;
  const home = t.locale === "ar" ? "/ar" : "/";
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center gap-3 sm:gap-6">
        <a href={home} aria-label={t.locale === "ar" ? "انترو" : "intro.sa"}><Wordmark lang={t.locale} className={t.locale === "ar" ? "h-[30px] sm:h-[34px]" : "h-[22px] sm:h-[26px]"} /></a>
        <nav aria-label={t.locale === "ar" ? "أقسام الصفحة" : "Page sections"} className="hidden items-center gap-1 md:flex">
          {([["#how", n.how], ["#uses", n.uses], ["#pricing", n.pricing], ["#faq", n.faq]] as const).map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-3 py-1.5 text-[14px] font-medium text-muted hover:bg-surface hover:text-ink">{label}</a>
          ))}
        </nav>
        <span className="flex-1" />
        <a href={n.other.href} lang={t.locale === "ar" ? "en" : "ar"} className={cx("text-[13.5px] font-medium text-muted hover:text-ink", t.locale === "ar" ? "font-latin" : "font-ar")}>{n.other.label}</a>
        {signedIn ? (
          <PillLink href={`/home?lang=${t.locale}`} className="px-4 py-2 text-[14px]">{n.myAccount}</PillLink>
        ) : (
          <>
            <a href={`/login?lang=${t.locale}`} className="hidden text-[14px] font-medium text-ink hover:text-brand sm:block">{n.signIn}</a>
            <PillLink href={start(t, { to: "new" })} className="px-4 py-2 text-[14px]">{n.cta}</PillLink>
          </>
        )}
      </Container>
    </header>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <span className="text-[13px] font-semibold tracking-[0.02em] text-accent-ink uppercase rtl:normal-case rtl:tracking-normal">{children}</span>;
}

function SectionHead({ eyebrow, heading, body, id }: { eyebrow: string; heading: string; body?: string; id: string }) {
  return (
    <div className="flex max-w-[720px] flex-col gap-3">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="display font-display text-[32px] leading-[1.1] font-medium tracking-[-1.2px] text-balance text-ink sm:text-[42px] sm:tracking-[-1.8px] rtl:leading-[1.3] rtl:tracking-normal">{heading}</h2>
      {body && <p className="text-[17px] leading-[27px] text-muted rtl:leading-[30px]">{body}</p>}
    </div>
  );
}

function Hero({ t }: { t: PitchCopy }) {
  const h = t.hero;
  const p = t.preview;
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden">
      <Contour seed={3} stroke="#14161310" className="[mask-image:linear-gradient(180deg,#000,transparent_85%)]" />
      <Container className="relative flex flex-col items-center gap-6 pt-14 pb-16 text-center sm:pt-20">
        <p className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 outline outline-1 -outline-offset-1 outline-line">
          <span className="size-[7px] rounded-full bg-accent" />
          <span className="text-[13.5px] font-medium text-ink">{h.pill}</span>
        </p>
        <h1 id="hero-heading" className="display font-display text-[42px] leading-[1.04] font-medium tracking-[-1.8px] text-balance text-ink sm:text-[64px] sm:tracking-[-3px] lg:text-[76px] lg:tracking-[-3.6px] rtl:text-[38px] rtl:leading-[1.3] rtl:tracking-normal rtl:sm:text-[56px] rtl:lg:text-[64px]">
          <span className="block">{h.headline[0]}</span>
          <span className="block text-brand">{h.headline[1]}</span>
        </h1>
        <p className="max-w-[640px] text-[17px] leading-[27px] text-muted sm:text-[18.5px] sm:leading-[30px] rtl:sm:leading-[32px]">{h.sub}</p>
        <PitchSearch search={t.search} locale={t.locale} />
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {h.proof.map((x) => (
            <li key={x.label} className="flex items-center gap-[7px] text-[13.5px] text-muted"><Icon name={x.icon} className="text-brand" />{x.label}</li>
          ))}
        </ul>

        {/* One result, as the app shows it: who, why now (with its source), a verified email. */}
        <figure className="mt-6 w-full max-w-[640px] text-start">
          <figcaption className="pb-2 text-center text-[12.5px] font-medium text-subtle">{p.label}</figcaption>
          <div className="flex flex-col gap-3 rounded-[18px] bg-white p-5 shadow-window outline outline-1 -outline-offset-1 outline-line">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint text-[15px] font-semibold text-brand">{p.name[0]}</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[16px] font-semibold text-ink">{p.name}</span>
                <span className="text-[13.5px] text-muted">{p.role} · {p.company}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 rounded-[12px] bg-surface-3 px-3.5 py-3 outline outline-1 -outline-offset-1 outline-line-2">
              <span className="flex items-center gap-1.5 text-[14px] text-ink"><Icon name="trend" size={14} className="text-accent" />{p.why}</span>
              <span className="text-[12.5px] text-subtle">{p.source}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-[13px] font-medium text-success-ink">
                <Icon name="check" size={13} /><span className="truncate font-latin" dir="ltr">{p.email}</span><span className="opacity-70">· {p.verified}</span>
              </span>
              <span className="flex-1" />
              <span className="rounded-full px-3 py-1.5 text-[13px] font-medium text-brand outline outline-1 -outline-offset-1 outline-line">{p.save}</span>
              <span className="rounded-full bg-brand px-3 py-1.5 text-[13px] font-medium text-white">{p.draft}</span>
            </div>
          </div>
        </figure>
      </Container>
    </section>
  );
}

function How({ t }: { t: PitchCopy }) {
  return (
    <section id="how" aria-labelledby="how-heading" className="scroll-mt-20 border-t border-line-2 bg-surface-3 py-20">
      <Container className="flex flex-col gap-10">
        <SectionHead id="how-heading" eyebrow={t.how.eyebrow} heading={t.how.heading} />
        <ol className="grid gap-4 md:grid-cols-3">
          {t.how.steps.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-3 rounded-[18px] bg-white p-6 outline outline-1 -outline-offset-1 outline-line">
              <span className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-white">{i + 1}</span>
                <Icon name={s.icon} className="text-brand" />
              </span>
              <h3 className="text-[18px] font-semibold text-ink">{s.title}</h3>
              <p className="text-[15px] leading-[24px] text-muted rtl:leading-[27px]">{s.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/**
 * What a result looks like, before anyone signs up. An invented person and
 * company, labelled as an example — the shape of the answer is the proof.
 */
const SAMPLE = {
  en: {
    eyebrow: "What you get", heading: "Not a list of names. A reason to write today.",
    body: "Every person comes with why they fit, what just happened at their company, and a first line you can send from your own email.",
    label: "Example result", goal: "Goal: meetings with heads of claims at Saudi insurers",
    name: "Sara Al-Harbi", role: "Head of Claims · Wafa Insurance (example)", fit: "Strong fit",
    whyT: "Why her", why: "She owns claims operations and the team's tooling budget — the person who'd sign a claims-automation pilot.",
    nowT: "Why now", now: "Wafa announced a digital claims programme two weeks ago and is hiring three claims analysts.", src: "News · 12 Nov",
    lineT: "First line", line: "Hi Sara — saw Wafa's new digital claims programme. We help claims teams cut handling time by a third; worth 20 minutes next week?",
    cta: "Get yours", note: "Illustrative example. Real results come from licensed business data and public news.",
  },
  ar: {
    eyebrow: "وش يوصلك", heading: "مو قائمة أسماء. سبب تكتب له اليوم.",
    body: "مع كل شخص: ليش يناسبك، ووش صار في شركته مؤخرًا، وأول سطر ترسله من بريدك.",
    label: "مثال على نتيجة", goal: "الهدف: اجتماعات مع رؤساء المطالبات في شركات التأمين السعودية",
    name: "سارة الحربي", role: "رئيسة المطالبات · وفاء للتأمين (مثال)", fit: "تطابق قوي",
    whyT: "ليش هي", why: "تدير عمليات المطالبات وميزانية أدوات الفريق، وهي اللي توقّع على تجربة لأتمتة المطالبات.",
    nowT: "ليش الحين", now: "أعلنت وفاء قبل أسبوعين برنامجًا رقميًا للمطالبات، وتوظّف ثلاثة محللي مطالبات.", src: "خبر · 12 نوفمبر",
    lineT: "أول سطر", line: "هلا سارة، شفت برنامج وفاء الجديد للمطالبات الرقمية. نساعد فرق المطالبات تختصر وقت المعالجة الثلث، يناسبك ٢٠ دقيقة الأسبوع الجاي؟",
    cta: "خذ قائمتك", note: "مثال توضيحي. النتائج الحقيقية من بيانات أعمال مرخّصة وأخبار عامة.",
  },
};

function Sample({ t }: { t: PitchCopy }) {
  const c = SAMPLE[t.locale === "ar" ? "ar" : "en"];
  const Row = ({ k, v, sub }: { k: string; v: string; sub?: string }) => (
    <div className="flex flex-col gap-1 border-t border-line-2 pt-3.5">
      <span className="text-[12.5px] font-semibold text-subtle">{k}</span>
      <p className="text-[15px] leading-[24px] text-ink rtl:leading-[27px]">{v}</p>
      {sub && <span className="text-[12px] text-subtle">{sub}</span>}
    </div>
  );
  return (
    <section id="sample" aria-labelledby="sample-heading" className="scroll-mt-20 py-20">
      <Container className="grid items-center gap-10 lg:grid-cols-[1fr_520px]">
        <div className="flex flex-col gap-6">
          <SectionHead id="sample-heading" eyebrow={c.eyebrow} heading={c.heading} body={c.body} />
          <a href={start(t)} className="flex h-12 w-fit items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-medium text-white hover:bg-brand-2">{c.cta}<Icon name="arrow-right" flip /></a>
          <p className="text-[12.5px] text-subtle">{c.note}</p>
        </div>
        <article aria-label={c.label} className="flex flex-col gap-3.5 rounded-[22px] bg-white p-6 shadow-[0_24px_60px_-28px_#1416134d] outline outline-1 -outline-offset-1 outline-line">
          <span className="w-fit rounded-full bg-sand px-2.5 py-1 text-[11.5px] font-semibold text-ink-2">{c.label}</span>
          <span className="text-[12.5px] text-subtle">{c.goal}</span>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-mint text-[16px] font-semibold text-brand">{c.name[0]}</span>
            <div className="flex min-w-0 flex-1 flex-col">
              <strong className="text-[16px] text-ink">{c.name}</strong>
              <span className="text-[13px] text-muted">{c.role}</span>
            </div>
            <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11.5px] font-semibold text-success-ink">{c.fit}</span>
          </div>
          <Row k={c.whyT} v={c.why} />
          <Row k={c.nowT} v={c.now} sub={c.src} />
          <div className="flex flex-col gap-1.5 border-t border-line-2 pt-3.5">
            <span className="text-[12.5px] font-semibold text-subtle">{c.lineT}</span>
            <p className="rounded-[12px] bg-surface-2 p-3.5 text-[14.5px] leading-[23px] text-ink rtl:leading-[26px]">{c.line}</p>
          </div>
        </article>
      </Container>
    </section>
  );
}

function Uses({ t }: { t: PitchCopy }) {
  const tones = ["bg-mint text-brand", "bg-peach text-accent-ink", "bg-sand text-ink", "bg-surface text-ink"];
  return (
    <section id="uses" aria-labelledby="uses-heading" className="scroll-mt-20 py-20">
      <Container className="flex flex-col gap-10">
        <SectionHead id="uses-heading" eyebrow={t.uses.eyebrow} heading={t.uses.heading} />
        <ul className="grid gap-4 sm:grid-cols-2">
          {t.uses.items.map((u, i) => {
            const href = u.mode === "request" ? start(t, { to: "new", q: u.example }) : start(t, { mode: u.mode, q: u.example, market: "SA" });
            return (
              <li key={u.title}>
                <a href={href} className="group flex h-full flex-col gap-4 rounded-[20px] bg-white p-6 outline outline-1 -outline-offset-1 outline-line transition-shadow hover:shadow-[0_18px_40px_-24px_#14161359]">
                  <span className={cx("flex size-11 items-center justify-center rounded-[12px]", tones[i % tones.length])}><Icon name={u.icon} size={18} /></span>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-[20px] font-semibold text-ink">{u.title}</h3>
                    <p className="text-[15px] leading-[24px] text-muted rtl:leading-[27px]">{u.body}</p>
                  </div>
                  <span className="mt-auto flex items-center gap-2 rounded-[12px] bg-surface-3 px-3.5 py-2.5 text-[14px] text-ink-2 outline outline-1 -outline-offset-1 outline-line-2">
                    <Icon name="search" size={14} className="shrink-0 text-subtle" />
                    <span className="min-w-0 flex-1 truncate" dir="auto">{u.example}</span>
                    <span className="flex shrink-0 items-center gap-1 font-medium text-brand">{t.uses.tryIt}<Icon name="arrow-right" size={13} flip /></span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

function Features({ t }: { t: PitchCopy }) {
  return (
    <section aria-labelledby="features-heading" className="border-t border-line-2 bg-surface-3 py-20">
      <Container className="flex flex-col gap-10">
        <SectionHead id="features-heading" eyebrow={t.features.eyebrow} heading={t.features.heading} />
        <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.items.map((f) => (
            <li key={f.title} className="flex gap-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-white text-brand outline outline-1 -outline-offset-1 outline-line"><Icon name={f.icon} /></span>
              <div className="flex flex-col gap-1">
                <h3 className="text-[16.5px] font-semibold text-ink">{f.title}</h3>
                <p className="text-[14.5px] leading-[23px] text-muted rtl:leading-[26px]">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function Pricing({ t }: { t: PitchCopy }) {
  const p = t.pricing;
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="scroll-mt-20 py-20">
      <Container className="flex flex-col gap-10">
        <SectionHead id="pricing-heading" eyebrow={p.eyebrow} heading={p.heading} body={p.body} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-1 rounded-[20px] bg-brand p-6 text-white">
            {p.costs.map((c) => (
              <div key={c.label} className="flex items-center justify-between gap-4 border-b border-white/15 py-3 last:border-0">
                <span className="text-[15px] text-white/85">{c.label}</span>
                <span className="text-[15px] font-semibold">{c.value}</span>
              </div>
            ))}
            <PillLink href={start(t, { to: "new" })} variant="light" className="mt-4 px-5 py-3">{p.cta}</PillLink>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[14px] font-medium text-subtle">{p.packs}</span>
            <ul className="grid gap-3 sm:grid-cols-3">
              {PACKAGES.map((k) => (
                <li key={k.id} className={cx("flex flex-col gap-1 rounded-[18px] bg-white p-5 outline -outline-offset-1", "popular" in k && k.popular ? "outline-2 outline-brand" : "outline-1 outline-line")}>
                  <span className="flex items-center justify-between gap-2 text-[14px] font-semibold text-ink">
                    {k[t.locale]}
                    {"popular" in k && k.popular && <span className="rounded-full bg-mint px-2 py-0.5 text-[11.5px] font-medium text-brand">{p.popular}</span>}
                  </span>
                  <span className="display font-display text-[34px] font-medium tracking-[-1px] text-ink">{k.sar} <span className="text-[15px] font-normal text-muted">{p.currency}</span></span>
                  <span className="text-[13.5px] text-muted">{p.perCredits(k.credits)}</span>
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-subtle">{p.note}</p>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Faq({ t }: { t: PitchCopy }) {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-20 border-t border-line-2 bg-surface-3 py-20">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <SectionHead id="faq-heading" eyebrow={t.faq.eyebrow} heading={t.faq.heading} />
        <div className="flex flex-col gap-2">
          {t.faq.items.map((f) => (
            <details key={f.q} className="group rounded-[16px] bg-white px-5 py-4 outline outline-1 -outline-offset-1 outline-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <Icon name="chevron-down" className="shrink-0 text-subtle transition-transform group-open:rotate-180" />
              </summary>
              <p className="pt-2.5 text-[15px] leading-[24px] text-muted rtl:leading-[27px]">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Close({ t }: { t: PitchCopy }) {
  return (
    <section aria-labelledby="close-heading" className="py-20">
      <Container className="flex flex-col items-center gap-5 text-center">
        <h2 id="close-heading" className="display font-display text-[34px] leading-[1.1] font-medium tracking-[-1.2px] text-ink sm:text-[46px] sm:tracking-[-2px] rtl:leading-[1.3] rtl:tracking-normal">{t.close.heading}</h2>
        <p className="max-w-[520px] text-[16.5px] leading-[26px] text-muted rtl:leading-[29px]">{t.close.body}</p>
        <PitchSearch search={t.search} locale={t.locale} compact />
      </Container>
    </section>
  );
}

function Footer({ t }: { t: PitchCopy }) {
  return (
    <footer className="border-t border-line bg-white py-10">
      <Container className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Wordmark lang={t.locale} className={t.locale === "ar" ? "h-[28px]" : "h-[20px]"} />
        <span className="text-[14px] text-muted">{t.footer.tagline}</span>
        <span className="flex-1" />
        <a href={t.nav.other.href} className="text-[13.5px] font-medium text-muted hover:text-ink">{t.nav.other.label}</a>
        <a href={`/privacy?lang=${t.locale}`} className="text-[13.5px] font-medium text-muted hover:text-ink">{t.locale === "ar" ? "الخصوصية" : "Privacy"}</a>
        <a href={`/terms?lang=${t.locale}`} className="text-[13.5px] font-medium text-muted hover:text-ink">{t.locale === "ar" ? "الشروط" : "Terms"}</a>
        <a href={`/login?lang=${t.locale}`} className="text-[13.5px] font-medium text-muted hover:text-ink">{t.nav.signIn}</a>
        <span className="text-[13px] text-subtle">{t.footer.rights}</span>
      </Container>
    </footer>
  );
}
