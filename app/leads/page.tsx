import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { pickLang } from "@/components/site/AuthShell";
import { Icon, cx } from "@/components/site/ui";
import * as repo from "@/lib/db/repo";
import { pageAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leads · intro" };

const C = {
  en: { title: "Your leads", sub: "Everyone you've saved from search, with what you've unlocked.", empty: "No leads yet.", emptySub: "Search for companies or people and save the ones worth a conversation.", start: "Start searching", email: "Email", locked: "Not revealed", open: "Open", verified: "Verified", unconfirmed: "Unconfirmed", notFound: "Not found" },
  ar: { title: "عملاؤك المحتملون", sub: "كل من حفظته من البحث، ومع كل واحد اللي كشفته عنه.", empty: "ما عندك عملاء محتملون بعد.", emptySub: "ابحث عن جهات أو أشخاص، واحفظ اللي يستاهل تبدأ معه حديث.", start: "ابدأ البحث", email: "البريد", locked: "لم يُكشف بعد", open: "افتح", verified: "موثّق", unconfirmed: "غير مؤكد", notFound: "غير موجود" },
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang: l } = await searchParams;
  const account = await pageAccount("/leads");
  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const t = C[lang];
  const [rows, credits] = await Promise.all([repo.listLeads(account.id), repo.creditBalance(account.id)]);

  return (
    <AppShell account={account} lang={lang} on="leads" credits={credits}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <h1 className="display font-display text-[30px] leading-[1.1] font-medium tracking-[-1px] text-ink">{t.title}</h1>
            <p className="text-[15px] text-muted">{t.sub}</p>
          </div>
          <a href={`/search?lang=${lang}`} className="flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-[14px] font-medium text-white hover:bg-brand-2"><Icon name="search" size={14} />{t.start}</a>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-[20px] bg-white p-8 outline outline-1 -outline-offset-1 outline-line">
            <span className="flex size-11 items-center justify-center rounded-[12px] bg-mint text-brand"><Icon name="users" size={18} /></span>
            <strong className="text-[17px] text-ink">{t.empty}</strong>
            <span className="text-[14.5px] text-muted">{t.emptySub}</span>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id}>
                <a href={`/leads/${r.id}?lang=${lang}`} className="flex flex-wrap items-center gap-3 rounded-[14px] bg-white p-4 outline outline-1 -outline-offset-1 outline-line hover:bg-surface-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-semibold text-ink">{r.person.latin[0]}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[14.5px] font-semibold text-ink" dir="auto">{r.person.latin}</span>
                    <span className="truncate text-[13px] text-muted" dir="auto">{r.person.title} · {r.person.company}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {r.email ? (
                      <>
                        <span className="font-latin text-[13px] text-ink" dir="ltr">{r.email}</span>
                        <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-medium", r.emailStatus === "valid" ? "bg-success-soft text-success-ink" : "bg-sand text-ink-2")}>{r.emailStatus === "valid" ? t.verified : t.unconfirmed}</span>
                      </>
                    ) : (
                      <span className="text-[12.5px] text-subtle">{r.emailStatus === "not_found" ? t.notFound : t.locked}</span>
                    )}
                    <Icon name="arrow-right" flip className="text-subtle" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
