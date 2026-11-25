import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { LeadActions } from "@/components/app/LeadActions";
import { pickLang } from "@/components/site/AuthShell";
import { Icon } from "@/components/site/ui";
import * as repo from "@/lib/db/repo";
import { MARKETS, isMarket } from "@/lib/search/markets";
import { openerFor } from "@/lib/search/opener";
import { pageAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead · intro" };

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { id } = await params;
  const { lang: l } = await searchParams;
  const account = await pageAccount(`/leads/${id}`);
  const lead = await repo.getLead(account.id, id);
  if (!lead) notFound();
  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const credits = await repo.creditBalance(account.id);
  const p = lead.person;
  const market = isMarket(lead.market) ? MARKETS[lead.market][lang] : "";

  return (
    <AppShell account={account} lang={lang} on="leads" credits={credits}>
      <a href={`/leads?lang=${lang}`} className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink">
        <Icon name="arrow-right" size={14} className="rotate-180 rtl:rotate-0" />{lang === "ar" ? "العملاء المحتملون" : "Leads"}
      </a>
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <aside className="flex h-fit flex-col gap-4 rounded-[20px] bg-white p-6 outline outline-1 -outline-offset-1 outline-line">
          <span className="flex size-14 items-center justify-center rounded-full bg-mint text-[22px] font-semibold text-brand">{p.latin[0]}</span>
          <div className="flex flex-col gap-1">
            <h1 className="display font-display text-[24px] font-medium tracking-[-0.6px] text-ink" dir="auto">{p.latin}</h1>
            <span className="text-[14.5px] text-muted" dir="auto">{p.title}</span>
          </div>
          <dl className="flex flex-col gap-2.5 border-t border-line pt-4 text-[13.5px]">
            <Row k={lang === "ar" ? "الجهة" : "Company"} v={p.company} />
            {p.companyDomain && <Row k={lang === "ar" ? "الموقع" : "Website"} v={<a href={`https://${p.companyDomain}`} target="_blank" rel="noreferrer" className="font-latin text-brand" dir="ltr">{p.companyDomain}</a>} />}
            {p.geo && <Row k={lang === "ar" ? "الموقع الجغرافي" : "Location"} v={p.geo} />}
            {market && <Row k={lang === "ar" ? "السوق" : "Market"} v={market} />}
            {p.linkedinUrl && <Row k="LinkedIn" v={<a href={p.linkedinUrl} target="_blank" rel="noreferrer" className="text-brand" dir="ltr">{lang === "ar" ? "الملف المهني ↗" : "Profile ↗"}</a>} />}
            {p.servedBy && <Row k={lang === "ar" ? "المصدر" : "Source"} v={<span className="font-latin" dir="ltr">{p.servedBy}</span>} />}
          </dl>
        </aside>
        <LeadActions
          lang={lang}
          leadId={lead.id}
          company={p.company}
          initialEmail={lead.email}
          initialStatus={lead.emailStatus}
          initialSignals={lead.signals ?? null}
          opener={openerFor({ lang, name: p.latin, company: p.company, signal: lead.signals?.[0]?.title, me: account })}
        />
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-subtle">{k}</dt>
      <dd className="text-end text-ink" dir="auto">{v}</dd>
    </div>
  );
}
