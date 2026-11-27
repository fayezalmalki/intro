import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { pickLang } from "@/components/site/AuthShell";
import { Icon, cx } from "@/components/site/ui";
import * as repo from "@/lib/db/repo";
import { pageAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leads · intro" };

const C = {
  en: {
    title: "Your leads", sub: (n: number, v: number) => `${n} saved · ${v} with a verified email`,
    empty: "No leads yet.", emptySub: "Search for companies or people and save the ones worth a conversation.", start: "Find people",
    export: "Export CSV", exportHint: "Your saved leads, for your own CRM or sheet. Exporting is free and contacts no one.",
    search: "Search name, company or title", all: "All", revealed: "Email revealed", locked: "Not revealed",
    none: "No leads match this filter.", clear: "Clear",
    head: { person: "Person", company: "Company", email: "Email", saved: "Saved" },
    lockedCell: "Not revealed", verified: "Verified", unconfirmed: "Unconfirmed", notFound: "Not found",
  },
  ar: {
    title: "عملاؤك المحتملون", sub: (n: number, v: number) => `${n} محفوظ · ${v} ببريد موثّق`,
    empty: "ما عندك عملاء محتملون بعد.", emptySub: "ابحث عن جهات أو أشخاص، واحفظ اللي يستاهل تبدأ معه حديث.", start: "ابحث عن أشخاص",
    export: "تنزيل CSV", exportHint: "عملاؤك المحفوظون لأدواتك أو جدولك. التنزيل مجاني وما نتواصل مع أحد.",
    search: "ابحث بالاسم أو الشركة أو المنصب", all: "الكل", revealed: "بريد مكشوف", locked: "غير مكشوف",
    none: "ما فيه عملاء بهذا الفلتر.", clear: "مسح",
    head: { person: "الشخص", company: "الشركة", email: "البريد", saved: "تاريخ الحفظ" },
    lockedCell: "لم يُكشف بعد", verified: "موثّق", unconfirmed: "غير مؤكد", notFound: "ما لقيناه",
  },
};

type Show = "all" | "revealed" | "locked";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ lang?: string; q?: string; show?: string }> }) {
  const { lang: l, q: rawQ, show: rawShow } = await searchParams;
  const account = await pageAccount("/leads");
  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const t = C[lang];
  const [all, credits] = await Promise.all([repo.listLeads(account.id), repo.creditBalance(account.id)]);

  const show: Show = rawShow === "revealed" || rawShow === "locked" ? rawShow : "all";
  const q = (rawQ ?? "").trim().toLowerCase().slice(0, 80);
  const revealedCount = all.filter((r) => r.email).length;
  const rows = all
    .filter((r) => (show === "revealed" ? r.email : show === "locked" ? !r.email : true))
    .filter((r) => !q || [r.person.latin, r.person.title, r.person.company, r.person.companyDomain].some((v) => v?.toLowerCase().includes(q)));
  const href = (s: Show, withQ = true) => `/leads?${new URLSearchParams({ lang, ...(s !== "all" && { show: s }), ...(withQ && q && { q }) })}`;

  return (
    <AppShell account={account} lang={lang} on="leads" credits={credits}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <h1 className="display font-display text-[30px] leading-[1.1] font-medium tracking-[-1px] text-ink">{t.title}</h1>
            <p className="text-[15px] text-muted">{t.sub(all.length, revealedCount)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {all.length > 0 && (
              <a href="/api/leads/export" title={t.exportHint} className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-medium text-ink outline outline-1 -outline-offset-1 outline-line hover:bg-surface">
                <Icon name="file-text" size={14} />{t.export}
              </a>
            )}
            <a href={`/search?lang=${lang}`} className="flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-[14px] font-medium text-white hover:bg-brand-2"><Icon name="search" size={14} />{t.start}</a>
          </div>
        </div>

        {all.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-[20px] bg-white p-8 outline outline-1 -outline-offset-1 outline-line">
            <span className="flex size-11 items-center justify-center rounded-[12px] bg-mint text-brand"><Icon name="users" size={18} /></span>
            <strong className="text-[17px] text-ink">{t.empty}</strong>
            <span className="text-[14.5px] text-muted">{t.emptySub}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <form action="/leads" method="get" className="flex h-10 min-w-0 flex-1 basis-[240px] items-center gap-2 rounded-[12px] bg-white px-3 outline outline-1 -outline-offset-1 outline-line sm:max-w-[340px]">
                <input type="hidden" name="lang" value={lang} />
                {show !== "all" && <input type="hidden" name="show" value={show} />}
                <Icon name="search" size={14} className="text-subtle" />
                <input name="q" defaultValue={q} dir="auto" placeholder={t.search} aria-label={t.search} className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-subtle" />
                {q && <a href={href(show, false)} className="text-[12.5px] text-muted hover:text-ink">{t.clear}</a>}
              </form>
              <nav aria-label={t.title} className="flex gap-0.5 rounded-[12px] bg-surface p-1">
                {(["all", "revealed", "locked"] as const).map((s) => (
                  <a key={s} href={href(s)} aria-current={show === s ? "true" : undefined}
                    className={cx("rounded-[9px] px-3 py-1.5 text-[13px] font-medium", show === s ? "bg-white text-ink shadow-[0_1px_2px_#0000001a]" : "text-muted hover:text-ink")}>
                    {t[s]} <span className="text-subtle">{s === "all" ? all.length : s === "revealed" ? revealedCount : all.length - revealedCount}</span>
                  </a>
                ))}
              </nav>
            </div>

            {rows.length === 0 ? (
              <p className="rounded-[14px] bg-white px-4 py-6 text-center text-[14.5px] text-muted outline outline-1 -outline-offset-1 outline-line">{t.none}</p>
            ) : (
              <div className="overflow-hidden rounded-[16px] bg-white outline outline-1 -outline-offset-1 outline-line">
                <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)_90px_20px] gap-4 border-b border-line bg-surface-3 px-4 py-2.5 text-[12px] font-medium text-subtle md:grid">
                  <span>{t.head.person}</span><span>{t.head.company}</span><span>{t.head.email}</span><span>{t.head.saved}</span><span />
                </div>
                <ul>
                  {rows.map((r) => (
                    <li key={r.id} className="border-b border-line-2 last:border-0">
                      <a href={`/leads/${r.id}?lang=${lang}`} className="grid grid-cols-[minmax(0,1fr)_20px] items-center gap-x-4 gap-y-1.5 px-4 py-3.5 hover:bg-surface-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)_90px_20px]">
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-semibold text-ink">{r.person.latin[0]}</span>
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-[14.5px] font-semibold text-ink" dir="auto">{r.person.latin}</span>
                            <span className="truncate text-[12.5px] text-muted" dir="auto">{r.person.title}</span>
                          </span>
                        </span>
                        <Icon name="arrow-right" flip className="text-subtle md:order-last" />
                        <span className="col-span-2 flex min-w-0 flex-col ps-12 md:col-span-1 md:ps-0">
                          <span className="truncate text-[13.5px] text-ink" dir="auto">{r.person.company}</span>
                          {r.person.companyDomain && <span className="truncate font-latin text-[12px] text-subtle" dir="ltr">{r.person.companyDomain}</span>}
                        </span>
                        <span className="col-span-2 flex min-w-0 items-center gap-2 ps-12 md:col-span-1 md:ps-0">
                          {r.email ? (
                            <>
                              <span className="truncate font-latin text-[13px] text-ink" dir="ltr">{r.email}</span>
                              <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", r.emailStatus === "valid" ? "bg-success-soft text-success-ink" : "bg-sand text-ink-2")}>{r.emailStatus === "valid" ? t.verified : t.unconfirmed}</span>
                            </>
                          ) : (
                            <span className="text-[12.5px] text-subtle">{r.emailStatus === "not_found" ? t.notFound : t.lockedCell}</span>
                          )}
                        </span>
                        <span className="hidden font-latin text-[12.5px] text-subtle md:block" dir="ltr">{r.createdAt.slice(0, 10)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
