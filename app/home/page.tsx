import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { Badge, Btn, Card, PageHeader, Starter, Tip } from "@/components/app/ui";
import { pickLang } from "@/components/site/AuthShell";
import { Icon, cx } from "@/components/site/ui";
import * as repo from "@/lib/db/repo";
import { loadMyRequests } from "@/lib/db/loaders";
import { presetHref } from "@/lib/search/presets";
import { pageAccount } from "@/lib/session";
import { ar as arDict } from "@/lib/site/ar";
import { en as enDict } from "@/lib/site/en";
import { REQUEST_STATUS } from "@/lib/app-copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Home · intro" };

const C = {
  en: {
    hi: (n: string) => `Welcome back, ${n}`,
    hiNew: (n: string) => `You're in, ${n}`,
    sub: "Find the right people, see why they matter now, and reach out — all from here.",
    welcome: "You have 3 free email reveals. Start with a goal below, or search for anyone in seconds.",
    setup: "Get set up", setupSub: (d: number, t: number) => `${d} of ${t} done`,
    steps: {
      profile: ["Complete your profile", "Done during sign-up"],
      search: ["Run your first search", "Companies, people or news — free"],
      lead: ["Save a lead", "Keep the people worth a conversation"],
      reveal: ["Reveal a verified email", "One credit; refunded if we find nothing"],
      request: ["Describe a goal", "We'll find the people and draft the first message"],
      activate: ["Activate sending", "Send first emails under your name"],
      pending: "Under review",
    },
    quick: "Who do you need to reach?", quickPh: "e.g. heads of procurement at private hospitals in Riyadh", quickGo: "Search",
    companies: "Companies", people: "People",
    starters: "Start from a goal", startersSub: "Each opens a ready search you can refine.",
    own: "Describe your own goal", ownSub: "One sentence; we'll take it from there",
    recentReq: "Your requests", recentLeads: "Your leads", all: "View all",
    noReq: "No requests yet — describe a goal and we'll find the people.", noLeads: "No leads yet — save people from search.",
    newReq: "New request", search: "Search",
  },
  ar: {
    hi: (n: string) => `أهلًا ${n}`,
    hiNew: (n: string) => `حيّاك ${n}`,
    sub: "اعثر على الأشخاص الصح، واعرف ليش يهمونك الحين، وابدأ التواصل، كل هذا من هنا.",
    welcome: "عندك ٣ كشوفات بريد مجانية. ابدأ بهدف من الأهداف تحت، أو ابحث عن أي شخص خلال ثوانٍ.",
    setup: "جهّز حسابك", setupSub: (d: number, t: number) => `أنجزت ${d} من ${t}`,
    steps: {
      profile: ["أكمل ملفك", "تم أثناء التسجيل"],
      search: ["أجرِ أول بحث", "جهات أو أشخاص أو أخبار، مجانًا"],
      lead: ["احفظ عميلًا محتملًا", "احتفظ بمن يستاهل تبدأ معه حديث"],
      reveal: ["اكشف بريدًا موثّقًا", "رصيد واحد، ويُسترجع إذا ما لقينا شيئًا"],
      request: ["اكتب هدفًا", "نلقى لك الأشخاص ونكتب أول رسالة"],
      activate: ["فعّل الإرسال", "أرسل رسائلك الأولى باسمك"],
      pending: "قيد المراجعة",
    },
    quick: "مين تبي توصل له؟", quickPh: "مثال: رؤساء المشتريات في المستشفيات الخاصة بالرياض", quickGo: "ابحث",
    companies: "الجهات", people: "الأشخاص",
    starters: "ابدأ من هدف", startersSub: "كل هدف يفتح لك بحثًا جاهزًا تقدر تعدّله.",
    own: "اكتب هدفك الخاص", ownSub: "جملة وحدة، والباقي علينا",
    recentReq: "طلباتك", recentLeads: "عملاؤك المحتملون", all: "عرض الكل",
    noReq: "ما عندك طلبات بعد. اكتب هدفك ونلقى لك الأشخاص.", noLeads: "ما عندك عملاء محتملون بعد. احفظهم من البحث.",
    newReq: "طلب جديد", search: "ابحث",
  },
};

export default async function HomePage({ searchParams }: { searchParams: Promise<{ lang?: string; welcome?: string }> }) {
  const { lang: l, welcome } = await searchParams;
  const account = await pageAccount("/home");
  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const t = C[lang];
  const dict = lang === "ar" ? arDict : enDict;
  const [stats, credits, recentLeads, mine] = await Promise.all([
    repo.journeyStats(account.id), repo.creditBalance(account.id), repo.listLeads(account.id), loadMyRequests(account.id),
  ]);
  const recentRequests = [...mine.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const first = account.displayName.split(/\s+/)[0];

  const checklist = [
    { key: "profile", done: Boolean(account.onboardedAt), href: "/welcome" },
    { key: "search", done: stats.searches > 0, href: `/search?lang=${lang}` },
    { key: "lead", done: stats.leads > 0, href: `/search?lang=${lang}` },
    { key: "reveal", done: stats.revealed > 0, href: stats.leads > 0 ? `/leads?lang=${lang}` : `/search?lang=${lang}` },
    { key: "request", done: stats.requests > 0, href: `/new?lang=${lang}` },
    { key: "activate", done: account.state !== "observer", pending: Boolean(account.activationRequestedAt), href: "/activate" },
  ] as const;
  const done = checklist.filter((c) => c.done).length;

  return (
    <AppShell account={account} lang={lang} on="home" credits={credits}>
      <div className="flex flex-col gap-8">
        <PageHeader
          title={welcome ? t.hiNew(first) : t.hi(first)}
          sub={t.sub}
          actions={<><Btn href={`/search?lang=${lang}`} variant="secondary" icon="search">{t.search}</Btn><Btn href={`/new?lang=${lang}`} icon="plus">{t.newReq}</Btn></>}
        />

        {welcome && <Tip icon="sparkles" title={lang === "ar" ? "حسابك جاهز" : "Your account is ready"}>{t.welcome}</Tip>}

        <form action="/search" method="get" className="flex flex-col gap-2.5 rounded-[20px] bg-white p-3 shadow-[0_18px_40px_-28px_#1416134d] outline outline-1 -outline-offset-1 outline-line sm:flex-row sm:items-center">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="run" value="1" />
          <label className="flex h-12 flex-1 items-center gap-2.5 rounded-[14px] bg-surface-2 px-3.5">
            <Icon name="search" className="text-subtle" />
            <input name="q" required dir="auto" placeholder={t.quickPh} aria-label={t.quick} className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-subtle" />
          </label>
          <div className="flex gap-2">
            {(["people", "companies"] as const).map((m, i) => (
              <label key={m} className="flex h-12 cursor-pointer items-center rounded-[14px] px-3.5 text-[13.5px] font-medium text-ink-2 outline outline-1 -outline-offset-1 outline-line has-[:checked]:bg-mint has-[:checked]:text-brand has-[:checked]:outline-brand/40">
                <input type="radio" name="mode" value={m} defaultChecked={i === 0} className="sr-only" />{t[m]}
              </label>
            ))}
            <button type="submit" className="flex h-12 cursor-pointer items-center gap-2 rounded-[14px] bg-brand px-5 text-[15px] font-medium text-white hover:bg-brand-2">{t.quickGo}</button>
          </div>
        </form>

        {done < checklist.length && (
          <Card as="section" className="p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[17px] font-semibold text-ink">{t.setup}</h2>
              <span className="flex items-center gap-3 text-[13px] text-subtle">
                {t.setupSub(done, checklist.length)}
                <span className="flex w-28 gap-1">{checklist.map((c, i) => <span key={i} className={cx("h-1.5 flex-1 rounded-full", c.done ? "bg-brand" : "bg-line")} />)}</span>
              </span>
            </div>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {checklist.map((c) => {
                const [title, body] = t.steps[c.key];
                const pending = "pending" in c && c.pending && !c.done;
                return (
                  <li key={c.key}>
                    <a href={c.href} className={cx("flex h-full items-start gap-3 rounded-[14px] p-3.5 transition-colors", c.done ? "bg-surface-3" : "outline outline-1 -outline-offset-1 outline-line hover:bg-surface-3")}>
                      <span className={cx("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", c.done ? "bg-brand text-white" : "bg-surface text-subtle")}>
                        <Icon name={c.done ? "check" : pending ? "clock" : "circle"} size={12} />
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className={cx("text-[14px] font-semibold", c.done ? "text-subtle line-through decoration-faint" : "text-ink")}>{title}</span>
                        <span className="text-[12.5px] leading-[18px] text-muted">{pending ? t.steps.pending : body}</span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}

        <section className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[17px] font-semibold text-ink">{t.starters}</h2>
            <span className="text-[13.5px] text-muted">{t.startersSub}</span>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {dict.useCases.items.map((u, i) => (
              <li key={u.id}><Starter href={presetHref(u.id, lang)} icon={u.icon} title={u.name} body={u.example} tone={i} /></li>
            ))}
            <li className="sm:col-span-2 lg:col-span-3"><Starter href={`/new?lang=${lang}`} icon="sparkles" title={t.own} body={t.ownSub} tone={2} /></li>
          </ul>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card as="section" className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between"><h2 className="text-[16px] font-semibold text-ink">{t.recentReq}</h2><a href={`/requests?lang=${lang}`} className="text-[13px] font-medium text-brand">{t.all}</a></div>
            {recentRequests.length === 0 ? <p className="text-[14px] text-muted">{t.noReq}</p> : (
              <ul className="flex flex-col gap-1.5">
                {recentRequests.map((r) => {
                  const s = REQUEST_STATUS[r.status];
                  return (
                    <li key={r.id}>
                      <a href={r.status === "intent_review" ? `/requests/${r.id}/confirm` : `/requests/${r.id}`} className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 hover:bg-surface-3">
                        <span className="min-w-0 flex-1 truncate text-[14px] text-ink" dir="auto">{r.rawText}</span>
                        <Badge tone={s.tone} dot>{s[lang]}</Badge>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card as="section" className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between"><h2 className="text-[16px] font-semibold text-ink">{t.recentLeads}</h2><a href={`/leads?lang=${lang}`} className="text-[13px] font-medium text-brand">{t.all}</a></div>
            {recentLeads.length === 0 ? <p className="text-[14px] text-muted">{t.noLeads}</p> : (
              <ul className="flex flex-col gap-1.5">
                {recentLeads.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <a href={`/leads/${r.id}?lang=${lang}`} className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 hover:bg-surface-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-avatar text-[12px] font-semibold text-ink">{r.person.latin[0]}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[14px] font-medium text-ink" dir="auto">{r.person.latin}</span>
                        <span className="truncate text-[12.5px] text-muted" dir="auto">{r.person.title} · {r.person.company}</span>
                      </span>
                      {r.email && <Badge tone="success">{lang === "ar" ? "بريد موثّق" : "Email"}</Badge>}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
