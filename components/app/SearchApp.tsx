"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon, cx, type IconKey } from "@/components/site/ui";
import { MARKETS, SECTOR_OPTIONS, SENIORITY_OPTIONS, type Market } from "@/lib/search/markets";
import type { SearchMode } from "@/lib/search/presets";

type Lang = "ar" | "en";
type Company = { name: string; domain: string; industry?: string; size?: string; linkedinUrl?: string };
type Person = { name: string; title: string; company: string; companyDomain: string; profileUrl?: string; location?: string; servedBy: string; seniority: string; leader: boolean };
type Signal = { url: string; title: string; source: string; date?: string };
type LeadState = { leadId?: string; saving?: boolean; revealing?: boolean; email?: string | null; status?: string; error?: string };

const C = {
  en: {
    title: "Find the right people",
    sub: "Search companies, decision makers and news across the Gulf — then save leads and reveal verified emails.",
    modes: { companies: "Companies", people: "People", person: "A specific person", news: "News & signals" } as Record<SearchMode, string>,
    modeHint: {
      companies: "By sector, keywords or name",
      people: "By company + role, or describe them",
      person: "Look someone up by name",
      news: "What's happening at a company",
    } as Record<SearchMode, string>,
    market: "Market", sector: "Sector", anySector: "Any sector", keywords: "Keywords", keywordsPh: "e.g. claims platform, cold chain, BNPL",
    companyName: "Or a company name", companyNamePh: "e.g. Lumen Pay",
    companyDomain: "Company website", companyDomainPh: "company.sa",
    role: "Role", rolePh: "e.g. Head of Procurement",
    describe: "Or describe who you need", describePh: "e.g. Procurement heads at private hospital groups in Riyadh",
    fullName: "Full name", fullNamePh: "e.g. Noura Alsaud", company: "Company (optional)", companyPh: "name or website",
    topic: "Company or topic", topicPh: "e.g. Lumen Pay, or 'insurance tenders'",
    search: "Search", searching: "Searching…",
    found: (n: number) => `${n} result${n === 1 ? "" : "s"}`,
    none: "Nothing matched. Try a broader sector, fewer keywords, or another market.",
    start: "Pick a way to search, set the market, and go.",
    decision: "Decision makers", news: "News", website: "Website",
    save: "Save lead", saved: "Saved", reveal: "Reveal email", revealing: "Looking up…", openLead: "Open lead",
    leader: "Decision maker", copy: "Copy",
    status: { valid: "Verified", risky: "Unconfirmed", invalid: "Invalid", not_found: "Not found — credit refunded" } as Record<string, string>,
    errors: {
      unavailable: "Search is warming up — live data isn't connected yet. Please try again shortly.",
      budget: "You've reached today's search limit. It resets at midnight UTC.",
      bad_query: "Add a bit more to search with.",
      upstream: "Our data providers didn't answer. Try again in a moment.",
      insufficient_credits: "You're out of credits. Top up to keep searching.",
      unauthenticated: "Your session ended. Sign in again.",
    } as Record<string, string>,
    peopleAt: (c: string) => `Decision makers at ${c}`,
    newsAt: (c: string) => `Latest at ${c}`,
    roles: "Quick roles",
    credits: (n: number) => `${n} credit${n === 1 ? "" : "s"} left`,
    cost: "1 credit per search · refunded if nothing is found", topUp: "Top up",
  },
  ar: {
    title: "اعثر على الأشخاص الصح",
    sub: "ابحث عن الجهات وأصحاب القرار والأخبار في الخليج، واحفظ العملاء المحتملين واكشف بريدهم الموثّق.",
    modes: { companies: "الجهات", people: "الأشخاص", person: "شخص محدد", news: "الأخبار والمؤشرات" } as Record<SearchMode, string>,
    modeHint: {
      companies: "حسب القطاع أو الكلمات أو الاسم",
      people: "حسب الجهة والمنصب، أو صفهم",
      person: "ابحث عن شخص باسمه",
      news: "وش الجديد في جهة معيّنة",
    } as Record<SearchMode, string>,
    market: "السوق", sector: "القطاع", anySector: "كل القطاعات", keywords: "كلمات مفتاحية", keywordsPh: "مثال: منصة مطالبات، سلاسل تبريد، اشترِ الآن وادفع لاحقًا",
    companyName: "أو اسم الجهة", companyNamePh: "مثال: لومن باي",
    companyDomain: "موقع الجهة", companyDomainPh: "company.sa",
    role: "المنصب", rolePh: "مثال: Head of Procurement",
    describe: "أو صف الأشخاص اللي تحتاجهم", describePh: "مثال: رؤساء المشتريات في مجموعات المستشفيات الخاصة بالرياض",
    fullName: "الاسم الكامل", fullNamePh: "مثال: Noura Alsaud", company: "الجهة (اختياري)", companyPh: "الاسم أو الموقع",
    topic: "الجهة أو الموضوع", topicPh: "مثال: لومن باي، أو منافسات التأمين",
    search: "ابحث", searching: "نبحث…",
    found: (n: number) => `${n} نتيجة`,
    none: "ما لقينا تطابق. جرّب قطاعًا أوسع، أو كلمات أقل، أو سوقًا آخر.",
    start: "اختر طريقة البحث، وحدد السوق، وابدأ.",
    decision: "أصحاب القرار", news: "الأخبار", website: "الموقع",
    save: "احفظ", saved: "محفوظ", reveal: "اكشف البريد", revealing: "نبحث عن البريد…", openLead: "افتح",
    leader: "صاحب قرار", copy: "نسخ",
    status: { valid: "موثّق", risky: "غير مؤكد", invalid: "غير صالح", not_found: "ما لقيناه، واسترجعنا الرصيد" } as Record<string, string>,
    errors: {
      unavailable: "البحث يتجهّز، والبيانات الحية ما تفعّلت بعد. جرّب بعد قليل.",
      budget: "وصلت لحد البحث اليومي، ويتجدد منتصف الليل بتوقيت غرينتش.",
      bad_query: "أضف تفاصيل أكثر عشان نبحث.",
      upstream: "مزوّدو البيانات ما ردّوا. جرّب بعد لحظات.",
      insufficient_credits: "خلص رصيدك. اشحن رصيدك عشان تكمل البحث.",
      unauthenticated: "انتهت جلستك. سجّل دخولك مرة ثانية.",
    } as Record<string, string>,
    peopleAt: (c: string) => `أصحاب القرار في ${c}`,
    newsAt: (c: string) => `آخر أخبار ${c}`,
    roles: "مناصب سريعة",
    credits: (n: number) => `باقي ${n} رصيد`,
    cost: "رصيد واحد لكل بحث، ويُسترجع إذا ما لقينا شيئًا", topUp: "اشحن رصيدك",
  },
};

const MODE_ICON: Record<SearchMode, IconKey> = { companies: "building", people: "users", person: "user-search", news: "file-text" };

export interface SearchDefaults {
  mode: SearchMode; market: Market; sector?: string; keywords?: string; role?: string; describe?: string;
  name?: string; fullName?: string; company?: string; topic?: string; run?: boolean;
}

function syncCredits(balance: unknown) {
  if (typeof balance !== "number") return;
  document.querySelectorAll("[data-credits]").forEach((el) => { el.textContent = String(balance); });
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const json = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(json.error ?? "upstream");
  syncCredits((json as { balance?: number }).balance);
  return json;
}

export function SearchApp({ lang, defaults, initialCredits }: { lang: Lang; defaults: SearchDefaults; initialCredits: number }) {
  const t = C[lang];
  const [mode, setMode] = useState<SearchMode>(defaults.mode);
  const [market, setMarket] = useState<Market>(defaults.market);
  const [sector, setSector] = useState(defaults.sector ?? "");
  const [keywords, setKeywords] = useState(defaults.keywords ?? "");
  const [name, setName] = useState(defaults.name ?? "");
  const [domain, setDomain] = useState("");
  const [role, setRole] = useState(defaults.role ?? "");
  const [describe, setDescribe] = useState(defaults.describe ?? "");
  const [fullName, setFullName] = useState(defaults.fullName ?? "");
  const [company, setCompany] = useState(defaults.company ?? "");
  const [topic, setTopic] = useState(defaults.topic ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [news, setNews] = useState<Signal[] | null>(null);
  const [credits, setCredits] = useState(initialCredits);
  const [leads, setLeads] = useState<Record<string, LeadState>>({});
  const [expanded, setExpanded] = useState<Record<string, { kind: "people" | "news"; busy: boolean; people?: Person[]; news?: Signal[]; error?: string }>>({});
  const ran = useRef(false);

  const say = (code: string) => t.errors[code] ?? t.errors.upstream;

  async function runSearch(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    setCompanies(null); setPeople(null); setNews(null); setExpanded({});
    try {
      if (mode === "companies") {
        const r = await api<{ results: Company[] }>("/api/search", { kind: "companies", market, sector, keywords, name });
        setCompanies(r.results);
      } else if (mode === "people") {
        const r = await api<{ results: Person[] }>("/api/search", { kind: "people", market, companyDomain: domain, title: role, keywords, describe });
        setPeople(r.results);
      } else if (mode === "person") {
        const r = await api<{ results: Person[] }>("/api/search", { kind: "person", market, fullName, company });
        setPeople(r.results);
      } else {
        const r = await api<{ results: Signal[] }>("/api/search", { kind: "news", market, company: topic });
        setNews(r.results);
      }
    } catch (e) {
      setError(say((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (defaults.run && !ran.current) {
      ran.current = true;
      void runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function expand(c: Company, kind: "people" | "news") {
    const key = c.domain;
    if (expanded[key]?.kind === kind && !expanded[key].busy) {
      setExpanded((x) => { const n = { ...x }; delete n[key]; return n; });
      return;
    }
    setExpanded((x) => ({ ...x, [key]: { kind, busy: true } }));
    try {
      if (kind === "people") {
        const r = await api<{ results: Person[] }>("/api/search", { kind: "people", market, companyDomain: c.domain, title: role || "Chief" });
        setExpanded((x) => ({ ...x, [key]: { kind, busy: false, people: r.results } }));
      } else {
        const r = await api<{ results: Signal[] }>("/api/search", { kind: "news", market, company: c.name });
        setExpanded((x) => ({ ...x, [key]: { kind, busy: false, news: r.results } }));
      }
    } catch (e) {
      setExpanded((x) => ({ ...x, [key]: { kind, busy: false, error: say((e as Error).message) } }));
    }
  }

  const personKey = (p: Person) => p.profileUrl ?? `${p.name}@${p.companyDomain}`;

  async function save(p: Person): Promise<string | undefined> {
    const key = personKey(p);
    if (leads[key]?.leadId) return leads[key].leadId;
    setLeads((x) => ({ ...x, [key]: { ...x[key], saving: true } }));
    try {
      const r = await api<{ leadId: string }>("/api/leads", { person: p, market });
      setLeads((x) => ({ ...x, [key]: { ...x[key], saving: false, leadId: r.leadId } }));
      return r.leadId;
    } catch (e) {
      setLeads((x) => ({ ...x, [key]: { ...x[key], saving: false, error: say((e as Error).message) } }));
    }
  }

  async function reveal(p: Person) {
    const key = personKey(p);
    const leadId = await save(p);
    if (!leadId) return;
    setLeads((x) => ({ ...x, [key]: { ...x[key], revealing: true, error: undefined } }));
    try {
      const r = await api<{ email: string | null; status: string; balance: number }>(`/api/leads/${leadId}/reveal`);
      setCredits(r.balance);
      // The header's balance lives outside this component; keep it in step.
      document.querySelectorAll("[data-credits]").forEach((el) => { el.textContent = String(r.balance); });
      setLeads((x) => ({ ...x, [key]: { ...x[key], revealing: false, email: r.email, status: r.status } }));
    } catch (e) {
      setLeads((x) => ({ ...x, [key]: { ...x[key], revealing: false, error: say((e as Error).message) } }));
    }
  }

  const input = "h-11 w-full rounded-xl bg-white px-3.5 text-[14.5px] text-ink outline outline-1 -outline-offset-1 outline-line placeholder:text-faint focus:outline-2 focus:outline-brand";
  const label = "text-[12.5px] font-medium text-subtle";
  const results = mode === "companies" ? companies : mode === "news" ? news : people;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="display font-display text-[30px] leading-[1.1] font-medium tracking-[-1px] text-ink">{t.title}</h1>
          <p className="max-w-[640px] text-[15px] text-muted rtl:leading-[26px]">{t.sub}</p>
        </div>
      </div>

      <form onSubmit={runSearch} className="flex flex-col gap-5 rounded-[22px] bg-white p-5 shadow-[0_18px_48px_-30px_#14161340] outline outline-1 -outline-offset-1 outline-line sm:p-6">
        <div role="tablist" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {(Object.keys(t.modes) as SearchMode[]).map((m) => (
            <button
              key={m} type="button" role="tab" aria-selected={mode === m}
              onClick={() => { setMode(m); setError(null); }}
              className={cx("flex cursor-pointer items-start gap-2.5 rounded-[14px] p-3 text-start transition-colors", mode === m ? "bg-mint outline outline-2 -outline-offset-2 outline-brand" : "bg-surface-3 outline outline-1 -outline-offset-1 outline-line hover:bg-surface")}
            >
              <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-[9px]", mode === m ? "bg-white text-brand" : "bg-white text-muted")}><Icon name={MODE_ICON[m]} size={15} /></span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[14px] font-semibold text-ink">{t.modes[m]}</span>
                <span className="text-[12px] leading-4 text-subtle rtl:leading-[18px]">{t.modeHint[m]}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className={label}>{t.market}</span>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MARKETS) as Market[]).map((m) => (
              <button key={m} type="button" onClick={() => setMarket(m)} className={cx("cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors", market === m ? "bg-brand text-white" : "bg-surface text-ink-2 hover:bg-hover")}>
                {MARKETS[m][lang]}
              </button>
            ))}
          </div>
        </div>

        {mode === "companies" && (
          <>
            <div className="flex flex-col gap-2">
              <span className={label}>{t.sector}</span>
              <div className="flex flex-wrap gap-1.5">
                <Chip on={!sector} onClick={() => setSector("")}>{t.anySector}</Chip>
                {SECTOR_OPTIONS.map((s) => <Chip key={s.id} on={sector === s.id} onClick={() => setSector(s.id)}>{s[lang]}</Chip>)}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.keywords}><input className={input} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t.keywordsPh} /></Field>
              <Field label={t.companyName}><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.companyNamePh} /></Field>
            </div>
            <RoleChips lang={lang} role={role} setRole={setRole} label={t.roles} />
          </>
        )}

        {mode === "people" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.companyDomain}><input className={`${input} font-latin`} dir="ltr" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder={t.companyDomainPh} /></Field>
              <Field label={t.role}><input className={input} dir="auto" value={role} onChange={(e) => setRole(e.target.value)} placeholder={t.rolePh} /></Field>
            </div>
            <RoleChips lang={lang} role={role} setRole={setRole} label={t.roles} />
            <Field label={t.describe}><input className={input} dir="auto" value={describe} onChange={(e) => setDescribe(e.target.value)} placeholder={t.describePh} /></Field>
            <Field label={t.keywords}><input className={input} dir="auto" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t.keywordsPh} /></Field>
          </>
        )}

        {mode === "person" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.fullName}><input className={input} dir="auto" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.fullNamePh} /></Field>
            <Field label={t.company}><input className={input} dir="auto" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t.companyPh} /></Field>
          </div>
        )}

        {mode === "news" && (
          <Field label={t.topic}><input className={input} dir="auto" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t.topicPh} /></Field>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col text-[13px] text-subtle">
            <span>{busy ? t.searching : results ? t.found(results.length) : t.start}</span>
            <span className="text-[12px] text-faint">{t.cost}</span>
          </span>
          <button type="submit" disabled={busy} className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-medium text-white hover:bg-brand-2 disabled:opacity-60">
            <Icon name="search" size={15} />
            {busy ? t.searching : t.search}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-[14px] text-accent-ink">
          {error}
          {error === t.errors.insufficient_credits && <a href={`/billing?lang=${lang}`} className="rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-medium text-white">{t.topUp}</a>}
        </p>
      )}

      {busy && (
        <ul className="flex flex-col gap-2.5" aria-hidden="true">
          {[0, 1, 2].map((i) => <li key={i} className="h-[76px] animate-pulse rounded-[16px] bg-white outline outline-1 -outline-offset-1 outline-line" />)}
        </ul>
      )}

      {!busy && results && results.length === 0 && <p className="rounded-xl bg-white px-4 py-6 text-center text-[14.5px] text-muted outline outline-1 -outline-offset-1 outline-line">{t.none}</p>}

      {!busy && companies && companies.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {companies.map((c) => {
            const x = expanded[c.domain];
            return (
              <li key={c.domain} className="rounded-[16px] bg-white outline outline-1 -outline-offset-1 outline-line">
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-mint text-[15px] font-bold text-brand">{c.name[0]}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold text-ink" dir="auto">{c.name}</span>
                    <span className="flex flex-wrap gap-x-2 text-[12.5px] text-subtle">
                      <a href={`https://${c.domain}`} target="_blank" rel="noreferrer" className="font-latin hover:text-ink" dir="ltr">{c.domain}</a>
                      {c.industry && <span>· {c.industry}</span>}
                      {c.size && <span dir="ltr">· {c.size}</span>}
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    <SmallBtn on={x?.kind === "people"} onClick={() => void expand(c, "people")} icon="users">{t.decision}</SmallBtn>
                    <SmallBtn on={x?.kind === "news"} onClick={() => void expand(c, "news")} icon="file-text">{t.news}</SmallBtn>
                  </span>
                </div>
                {x && (
                  <div className="border-t border-line-2 bg-surface-3 p-3 sm:p-4">
                    {x.busy && <div className="h-12 animate-pulse rounded-xl bg-white" />}
                    {x.error && <p className="text-[13.5px] text-accent-ink">{x.error}</p>}
                    {x.people && (x.people.length ? (
                      <ul className="flex flex-col gap-2">{x.people.map((p) => <PersonRow key={personKey(p)} p={p} t={t} state={leads[personKey(p)]} onSave={() => void save(p)} onReveal={() => void reveal(p)} lang={lang} />)}</ul>
                    ) : <p className="text-[13.5px] text-muted">{t.none}</p>)}
                    {x.news && (x.news.length ? <NewsList items={x.news} /> : <p className="text-[13.5px] text-muted">{t.none}</p>)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!busy && people && people.length > 0 && (
        <ul className="flex flex-col gap-2">{people.map((p) => <PersonRow key={personKey(p)} p={p} t={t} state={leads[personKey(p)]} onSave={() => void save(p)} onReveal={() => void reveal(p)} lang={lang} />)}</ul>
      )}

      {!busy && news && news.length > 0 && <NewsList items={news} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5"><span className="text-[12.5px] font-medium text-subtle">{label}</span>{children}</label>;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cx("cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors", on ? "bg-mint text-brand outline outline-1 -outline-offset-1 outline-brand/40" : "bg-white text-ink-2 outline outline-1 -outline-offset-1 outline-line hover:bg-surface")}>
      {children}
    </button>
  );
}

function RoleChips({ lang, role, setRole, label }: { lang: Lang; role: string; setRole: (r: string) => void; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12.5px] font-medium text-subtle">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {SENIORITY_OPTIONS.map((s) => <Chip key={s.id} on={role === s.id} onClick={() => setRole(role === s.id ? "" : s.id)}>{s[lang]}</Chip>)}
      </div>
    </div>
  );
}

function SmallBtn({ on, onClick, icon, children }: { on?: boolean; onClick: () => void; icon: IconKey; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cx("flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors", on ? "bg-brand text-white" : "bg-surface text-ink hover:bg-hover")}>
      <Icon name={icon} size={14} />{children}
    </button>
  );
}

function PersonRow({ p, t, state, onSave, onReveal, lang }: { p: Person; t: (typeof C)["en"]; state?: LeadState; onSave: () => void; onReveal: () => void; lang: Lang }) {
  const status = state?.status;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[14px] bg-white p-3.5 outline outline-1 -outline-offset-1 outline-line">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-semibold text-ink">{p.name[0]}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14.5px] font-semibold text-ink" dir="auto">{p.name}</span>
          {p.leader && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success-ink">{t.leader}</span>}
          {p.profileUrl && <a href={p.profileUrl} target="_blank" rel="noreferrer" className="text-[12px] font-medium text-brand hover:underline" dir="ltr">LinkedIn ↗</a>}
        </span>
        <span className="truncate text-[13px] text-muted" dir="auto">{p.title}{p.company ? ` · ${p.company}` : ""}</span>
        {p.location && <span className="text-[12px] text-subtle" dir="auto">{p.location}</span>}
        {state?.email && (
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-latin text-[13.5px] font-medium text-ink" dir="ltr">{state.email}</span>
            <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-medium", status === "valid" ? "bg-success-soft text-success-ink" : "bg-sand text-ink-2")}>{t.status[status ?? "risky"]}</span>
            <button type="button" className="cursor-pointer text-[12px] text-brand" onClick={() => void navigator.clipboard?.writeText(state.email!)}>{t.copy}</button>
          </span>
        )}
        {state && !state.email && status && <span className="mt-1 text-[12.5px] text-subtle">{t.status[status]}</span>}
        {state?.error && <span className="mt-1 text-[12.5px] text-accent-ink">{state.error}</span>}
      </span>
      <span className="flex gap-1.5">
        {state?.leadId ? (
          <a href={`/leads/${state.leadId}?lang=${lang}`} className="flex h-9 items-center gap-1.5 rounded-full bg-mint px-3 text-[13px] font-medium text-brand"><Icon name="check" size={14} />{t.openLead}</a>
        ) : (
          <button type="button" disabled={state?.saving} onClick={onSave} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-medium text-ink hover:bg-hover"><Icon name="plus" size={14} />{t.save}</button>
        )}
        {!state?.email && (
          <button type="button" disabled={state?.revealing} onClick={onReveal} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-brand px-3 text-[13px] font-medium text-white hover:bg-brand-2 disabled:opacity-60">
            <Icon name="mail" size={14} />{state?.revealing ? t.revealing : t.reveal}
          </button>
        )}
      </span>
    </li>
  );
}

function NewsList({ items }: { items: Signal[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((n) => (
        <li key={n.url}>
          <a href={n.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[12px] bg-white px-3.5 py-3 outline outline-1 -outline-offset-1 outline-line hover:bg-surface-2">
            <Icon name="file-text" size={14} className="text-brand" />
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink" dir="auto">{n.title}</span>
            <span className="shrink-0 font-latin text-[12px] text-subtle" dir="ltr">{n.source}{n.date ? ` · ${n.date}` : ""}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
