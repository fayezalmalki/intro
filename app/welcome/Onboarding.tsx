"use client";

import { useState, type ReactNode } from "react";
import { SubmitButton } from "@/components/app/SubmitButton";
import { inputCls, labelCls } from "@/components/site/AuthShell";
import { Icon, cx, type IconKey } from "@/components/site/ui";
import { completeOnboarding } from "@/lib/actions";
import { GOALS, SECTORS, WHO, firstSearch, isIntentfulNext, parseSource } from "@/lib/onboarding";
import { MARKETS, type Market } from "@/lib/search/markets";
import type { UseCaseId } from "@/lib/site/types";

type Lang = "ar" | "en";
type Read =
  | { kind: "linkedin"; name: string; headline?: string; location?: string; about?: string; company?: string; linkedinUrl: string }
  | { kind: "website"; name: string; domain: string; description?: string; industry?: string; employees?: number };

const C = {
  en: {
    hi: "Let's set you up", sub: "Paste your LinkedIn or your company's website. We read the public page, ask three quick questions, and run your first search.",
    sourcePh: "linkedin.com/in/you  or  yourcompany.sa", read: "Read it", reading: "Reading…", skip: "Skip — I'll type it",
    sourceHint: "Free. We only read public information, once, to set up your account.",
    errors: { bad_source: "Paste a LinkedIn profile link (linkedin.com/in/…) or a website (company.sa).", not_found: "We couldn't read that page. Check the link, or skip and type it.", limit: "You've used your reads. Type your details instead.", unavailable: "Reading isn't available right now. Type your details instead.", upstream: "That didn't work. Try again, or skip and type it." } as Record<string, string>,
    readLinkedin: (n: string) => `Read ${n}'s LinkedIn`, readWebsite: (n: string) => `Read ${n}'s website`, typed: "Your details",
    you: "About you", name: "Full name", role: "Your role", rolePh: "e.g. Head of Sales", company: "Company", optional: "optional", website: "Company website",
    looksRight: "Looks right", edit: "Edit",
    q: "Three quick ones", qSub: "Tap your answers, then we search.",
    tabs: ["What", "Where", "Who"],
    q1: (n: string) => `What are you after${n ? `, ${n}` : ""}?`, q2: "Which sector, and where?", q3: "Who do you want to reach?",
    anySector: "Any sector", market: "Market",
    finish: "Show me who to talk to", finishing: "Setting up your first search…",
    after: ["Search companies in your sector", "Find who decides there", "Verified emails, 1 credit each — refunded if not found"],
    stepOf: (a: number, b: number) => `${a} of ${b}`,
  },
  ar: {
    hi: "خلّنا نجهّز حسابك", sub: "حط رابط لينكدإن أو موقع شركتك. نقرأ الصفحة العامة، ونسألك ثلاث أسئلة سريعة، ونشغّل أول بحث لك.",
    sourcePh: "linkedin.com/in/you  أو  yourcompany.sa", read: "اقرأه", reading: "نقرأ…", skip: "تخطَّ، بكتبها بنفسي",
    sourceHint: "مجاني. نقرأ المعلومات العامة فقط، مرة وحدة، عشان نجهّز حسابك.",
    errors: { bad_source: "حط رابط ملف لينكدإن (linkedin.com/in/…) أو موقع (company.sa).", not_found: "ما قدرنا نقرأ الصفحة. تأكد من الرابط، أو تخطَّ واكتبها.", limit: "استخدمت محاولات القراءة. اكتب معلوماتك بدالها.", unavailable: "القراءة غير متاحة الحين. اكتب معلوماتك بدالها.", upstream: "ما زبطت. جرّب مرة ثانية، أو تخطَّ واكتبها." } as Record<string, string>,
    readLinkedin: (n: string) => `قرأنا لينكدإن ${n}`, readWebsite: (n: string) => `قرأنا موقع ${n}`, typed: "معلوماتك",
    you: "عنك", name: "الاسم الكامل", role: "منصبك", rolePh: "مثال: مدير المبيعات", company: "الشركة", optional: "اختياري", website: "موقع الشركة",
    looksRight: "تمام", edit: "عدّل",
    q: "ثلاث أسئلة سريعة", qSub: "اختر إجاباتك، وبعدها نبحث.",
    tabs: ["وش", "وين", "مين"],
    q1: (n: string) => `وش تدوّر عليه${n ? ` يا ${n}` : ""}؟`, q2: "أي قطاع، ووين؟", q3: "مين تبي توصل له؟",
    anySector: "كل القطاعات", market: "السوق",
    finish: "ورّني مين أكلّم", finishing: "نجهّز أول بحث لك…",
    after: ["نبحث عن شركات في قطاعك", "نلقى مين صاحب القرار فيها", "بريد موثّق برصيد واحد، ويرجع إذا ما لقيناه"],
    stepOf: (a: number, b: number) => `${a} من ${b}`,
  },
};

export interface OnboardingDefaults { name: string; jobTitle: string; company: string; website: string; linkedinUrl: string; useCase?: string }

export function Onboarding({ lang, next, defaults }: { lang: Lang; next: string; defaults: OnboardingDefaults }) {
  const t = C[lang];
  const [stage, setStage] = useState<"source" | "review" | "questions">("source");
  const [source, setSource] = useState(defaults.linkedinUrl || defaults.website);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState<Read | null>(null);
  const [me, setMe] = useState({ ...defaults });
  const [q, setQ] = useState(0);
  const [goal, setGoal] = useState<UseCaseId | null>(GOALS.some((g) => g.id === defaults.useCase) ? (defaults.useCase as UseCaseId) : null);
  const [sector, setSector] = useState<string | null>(null);
  const [market, setMarket] = useState<Market>("SA");
  const [who, setWho] = useState<string | null>(null);

  async function readSource() {
    const parsed = parseSource(source);
    if (!parsed) { setError(t.errors.bad_source); return; }
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/onboarding/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source }) });
      const json = (await r.json().catch(() => ({}))) as { result?: Read; error?: string };
      if (!r.ok || !json.result) { setError(t.errors[json.error ?? "upstream"] ?? t.errors.upstream); return; }
      const x = json.result;
      setRead(x);
      setMe((m) => x.kind === "linkedin"
        ? { ...m, name: m.name || x.name, jobTitle: m.jobTitle || shortRole(x.headline), company: m.company || (x.company ?? ""), linkedinUrl: x.linkedinUrl }
        : { ...m, company: m.company || x.name, website: x.domain });
      if (x.kind === "website" && x.industry && SECTORS.some((s) => s.id === x.industry)) setSector(x.industry);
      setStage("review");
    } catch {
      setError(t.errors.upstream);
    } finally {
      setBusy(false);
    }
  }

  const first = me.name.trim().split(/\s+/)[0] ?? "";
  const target = goal && who ? (isIntentfulNext(next) ? next : firstSearch({ goal, sector: sector ?? undefined, who, market }, lang)) : next;
  const canReview = me.name.trim() && me.jobTitle.trim();

  return (
    <form action={completeOnboarding} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={target} />
      <input type="hidden" name="locale" value={lang} />
      <input type="hidden" name="useCase" value={goal ?? ""} />
      <input type="hidden" name="linkedinUrl" value={me.linkedinUrl} />

      <div className="flex flex-col gap-2">
        <h1 className="display font-display text-[28px] leading-[1.1] font-medium tracking-[-1px] text-ink">{t.hi}</h1>
        <p className="text-[15px] leading-[23px] text-muted rtl:leading-[26px]">{t.sub}</p>
      </div>

      <div className="flex flex-col divide-y divide-dashed divide-line overflow-hidden rounded-[22px] bg-white outline outline-1 -outline-offset-1 outline-line">
        {/* 1 · Source → what we read */}
        <Row icon={read ? "check" : "link"} done={stage !== "source"} title={stage === "source" ? t.you : read ? (read.kind === "linkedin" ? t.readLinkedin(read.name.split(" ")[0]) : t.readWebsite(read.name)) : t.typed}
          action={stage !== "source" ? <button type="button" onClick={() => setStage("review")} className="text-[13px] font-medium text-brand">{t.edit}</button> : undefined}>
          {stage === "source" && (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={source} onChange={(e) => setSource(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void readSource(); } }}
                  dir="ltr" inputMode="url" placeholder={t.sourcePh} aria-label={t.sourcePh} className={`${inputCls} font-latin rtl:text-right`} />
                <button type="button" data-testid="onboarding-read" onClick={() => void readSource()} disabled={busy || !source.trim()} className="flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-5 text-[14.5px] font-medium text-white hover:bg-brand-2 disabled:opacity-50">
                  {busy ? <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Icon name="search" size={14} />}{busy ? t.reading : t.read}
                </button>
              </div>
              {error && <p role="alert" className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13.5px] text-accent-ink">{error}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12.5px] text-subtle">{t.sourceHint}</span>
                <button type="button" onClick={() => { setError(null); setStage("review"); }} className="text-[13px] font-medium text-muted hover:text-ink">{t.skip}</button>
              </div>
            </div>
          )}
          {stage !== "source" && read && <ReadChips read={read} />}
          {stage === "review" && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t.name}><input required value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} autoComplete="name" name="name" className={inputCls} /></Field>
                <Field label={t.role}><input required value={me.jobTitle} onChange={(e) => setMe({ ...me, jobTitle: e.target.value })} name="jobTitle" placeholder={t.rolePh} className={inputCls} /></Field>
                <Field label={<>{t.company} <span className="font-normal text-subtle">· {t.optional}</span></>}><input value={me.company} onChange={(e) => setMe({ ...me, company: e.target.value })} name="company" autoComplete="organization" className={inputCls} /></Field>
                <Field label={<>{t.website} <span className="font-normal text-subtle">· {t.optional}</span></>}><input value={me.website} onChange={(e) => setMe({ ...me, website: e.target.value })} name="companyWebsite" dir="ltr" inputMode="url" placeholder="yourcompany.sa" className={`${inputCls} font-latin rtl:text-right`} /></Field>
              </div>
              <button type="button" data-testid="onboarding-looks-right" disabled={!canReview} onClick={() => setStage("questions")} className="flex h-11 cursor-pointer items-center justify-center gap-2 self-start rounded-full bg-brand px-5 text-[14.5px] font-medium text-white hover:bg-brand-2 disabled:opacity-50">
                {t.looksRight}<Icon name="arrow-right" size={14} flip />
              </button>
            </div>
          )}
          {stage === "questions" && (
            <>
              <input type="hidden" name="name" value={me.name} />
              <input type="hidden" name="jobTitle" value={me.jobTitle} />
              <input type="hidden" name="company" value={me.company} />
              <input type="hidden" name="companyWebsite" value={me.website} />
            </>
          )}
        </Row>

        {/* 2 · Three quick ones */}
        <Row icon="sparkles" done={false} dim={stage !== "questions"} title={t.q} sub={stage === "questions" ? t.qSub : undefined}
          action={stage === "questions" ? <span className="text-[12.5px] text-subtle">{t.stepOf(Math.min(q + 1, 3), 3)}</span> : undefined}>
          {stage === "questions" && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-1.5">
                {t.tabs.map((label, i) => (
                  <button key={label} type="button" onClick={() => (i === 0 || (i === 1 && goal) || (i === 2 && goal)) && setQ(i)}
                    className={cx("rounded-full px-3.5 py-1.5 text-[13px] font-medium", q === i ? "bg-ink text-white" : i < q ? "bg-mint text-brand" : "bg-surface text-subtle")}>{label}</button>
                ))}
              </div>
              <div className="flex flex-col gap-3.5 rounded-[18px] bg-surface-3 p-4 outline outline-1 -outline-offset-1 outline-line-2 sm:p-5">
                {q === 0 && (
                  <>
                    <h2 className="display font-display text-[22px] font-medium tracking-[-0.5px] text-ink">{t.q1(first)}</h2>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {GOALS.map((g, i) => (
                        <button key={g.id} type="button" data-testid={`goal-${g.id}`} onClick={() => { setGoal(g.id); setWho(null); setQ(1); }}
                          className={cx("flex cursor-pointer items-center gap-3 rounded-[14px] bg-white p-3 text-start outline -outline-offset-1 transition-colors hover:bg-mint/40", goal === g.id ? "outline-2 outline-brand" : "outline-1 outline-line")}>
                          <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-[11px]", ["bg-mint text-brand", "bg-peach text-accent-ink", "bg-sand text-ink"][i % 3])}><Icon name={g.icon} size={17} /></span>
                          <span className="flex flex-col"><span className="text-[15px] font-semibold text-ink">{g[lang]}</span><span className="text-[12.5px] text-muted">{g.hint[lang]}</span></span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {q === 1 && (
                  <>
                    <h2 className="display font-display text-[22px] font-medium tracking-[-0.5px] text-ink">{t.q2}</h2>
                    <div className="flex flex-wrap gap-1.5">
                      <Pill testId="sector-any" on={sector === ""} onClick={() => { setSector(""); setQ(2); }}>{t.anySector}</Pill>
                      {SECTORS.map((s) => <Pill key={s.id} testId={`sector-${s.id}`} on={sector === s.id} onClick={() => { setSector(s.id); setQ(2); }}>{s[lang]}</Pill>)}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-line-2 pt-3">
                      <span className="text-[12.5px] text-subtle">{t.market}</span>
                      {(Object.keys(MARKETS) as Market[]).map((m) => <Pill key={m} small on={market === m} onClick={() => setMarket(m)}>{MARKETS[m][lang]}</Pill>)}
                    </div>
                  </>
                )}
                {q === 2 && goal && (
                  <>
                    <h2 className="display font-display text-[22px] font-medium tracking-[-0.5px] text-ink">{t.q3}</h2>
                    <div className="flex flex-wrap gap-2">
                      {WHO[goal].map((w) => <Pill key={w.id} testId={`who-${w.id}`} big on={who === w.id} onClick={() => setWho(w.id)}>{w[lang]}</Pill>)}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </Row>

        {/* 3 · What happens next */}
        <Row icon="search" done={false} dim={!who} title={t.after[0]}>
          <ul className="flex flex-col gap-1.5 text-[13px] text-muted">
            <li className="flex items-center gap-2"><Icon name="users" size={13} className="text-brand" />{t.after[1]}</li>
            <li className="flex items-center gap-2"><Icon name="at-sign" size={13} className="text-brand" />{t.after[2]}</li>
          </ul>
        </Row>
      </div>

      <SubmitButton pending={t.finishing} icon="arrow-right" testId="onboarding-finish" disabled={stage !== "questions" || !goal || !who}>{t.finish}</SubmitButton>
    </form>
  );
}

/** "Product Manager | Business Development | …" → "Product Manager". */
function shortRole(headline?: string): string {
  if (!headline) return "";
  return headline.split(/[|•·@,]| at /)[0].trim().slice(0, 80);
}

function Row({ icon, title, sub, done, dim, action, children }: { icon: IconKey; title: ReactNode; sub?: string; done: boolean; dim?: boolean; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className={cx("flex gap-3.5 p-4 sm:p-5", dim && "opacity-55")}>
      <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-[12px]", done ? "bg-success-soft text-success-ink" : "bg-mint text-brand")}><Icon name={done ? "check" : icon} size={17} /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
            {sub && <span className="text-[13px] text-muted">{sub}</span>}
          </div>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

function ReadChips({ read }: { read: Read }) {
  const chips = read.kind === "linkedin"
    ? [read.headline, read.company, read.location].filter(Boolean)
    : [read.industry, read.employees ? `${read.employees.toLocaleString("en")}+` : undefined, read.domain].filter(Boolean);
  const blurb = read.kind === "linkedin" ? read.about : read.description;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => <span key={i} className={cx("max-w-full truncate rounded-full px-2.5 py-1 text-[12.5px] font-medium", ["bg-mint text-brand", "bg-sand text-ink-2", "bg-peach text-accent-ink"][i % 3])} dir="auto">{c}</span>)}
      </div>
      {blurb && <p className="line-clamp-2 text-[13px] leading-[20px] text-muted" dir="auto">{blurb}</p>}
    </div>
  );
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5"><span className={labelCls}>{label}</span>{children}</label>;
}

function Pill({ on, onClick, children, small, big, testId }: { on: boolean; onClick: () => void; children: ReactNode; small?: boolean; big?: boolean; testId?: string }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} className={cx("cursor-pointer rounded-full font-medium transition-colors",
      big ? "px-4 py-2.5 text-[14.5px]" : small ? "px-2.5 py-1 text-[12.5px]" : "px-3 py-1.5 text-[13.5px]",
      on ? "bg-brand text-white" : "bg-white text-ink-2 outline outline-1 -outline-offset-1 outline-line hover:bg-surface")}>{children}</button>
  );
}
