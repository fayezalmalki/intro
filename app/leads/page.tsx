import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { pickLang } from "@/components/site/AuthShell";
import { Icon, cx } from "@/components/site/ui";
import { AutoSubmitSelect } from "@/components/app/AutoSubmitSelect";
import { updateLeadAction } from "@/lib/actions";
import { STAGES, STAGE_LABEL } from "@/lib/crm";
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
    add: "Add a lead", import: "Import", board: "Board", list: "List", tag: "Tag", nextStep: "Next",
    imported: (n: number, k: number) => `Imported ${n} lead${n === 1 ? "" : "s"}${k ? ` · ${k} row(s) skipped (need a name and a company)` : ""}.`,
    emptyCrm: "Or add people you already know — by hand or from a sheet. The CRM works without sending anything from intro.",
    due: "Follow-up due", stages: { saved: "", contacted: "Contacted", replied: "Replied", meeting: "Meeting", closed: "Closed" } as Record<string, string>,
  },
  ar: {
    title: "عملاؤك المحتملون", sub: (n: number, v: number) => `${n} محفوظ · ${v} ببريد موثّق`,
    empty: "ما عندك عملاء محتملون بعد.", emptySub: "ابحث عن جهات أو أشخاص، واحفظ اللي يستاهل تبدأ معه حديث.", start: "ابحث عن أشخاص",
    export: "تنزيل CSV", exportHint: "عملاؤك المحفوظون لأدواتك أو جدولك. التنزيل مجاني وما نتواصل مع أحد.",
    search: "ابحث بالاسم أو الشركة أو المنصب", all: "الكل", revealed: "بريد مكشوف", locked: "غير مكشوف",
    none: "ما فيه عملاء بهذا الفلتر.", clear: "مسح",
    head: { person: "الشخص", company: "الشركة", email: "البريد", saved: "تاريخ الحفظ" },
    lockedCell: "لم يُكشف بعد", verified: "موثّق", unconfirmed: "غير مؤكد", notFound: "ما لقيناه",
    add: "أضف عميلًا", import: "استيراد", board: "لوحة", list: "قائمة", tag: "وسم", nextStep: "التالي",
    imported: (n: number, k: number) => `استوردنا ${n} عميل${k ? ` · تخطينا ${k} صف (يلزم الاسم والشركة)` : ""}.`,
    emptyCrm: "أو أضف أشخاص تعرفهم، يدويًا أو من جدول. إدارة العملاء تشتغل بدون ما ترسل شيء من انترو.",
    due: "حان موعد المتابعة", stages: { saved: "", contacted: "تواصلت", replied: "ردّ", meeting: "اجتماع", closed: "مغلق" } as Record<string, string>,
  },
};

type Show = "all" | "revealed" | "locked";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ lang?: string; q?: string; show?: string; view?: string; tag?: string; imported?: string; skipped?: string }> }) {
  const { lang: l, q: rawQ, show: rawShow, view: rawView, tag, imported, skipped } = await searchParams;
  const account = await pageAccount("/leads");
  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const t = C[lang];
  const [all, credits] = await Promise.all([repo.listLeads(account.id), repo.creditBalance(account.id)]);

  const show: Show = rawShow === "revealed" || rawShow === "locked" ? rawShow : "all";
  const q = (rawQ ?? "").trim().toLowerCase().slice(0, 80);
  const revealedCount = all.filter((r) => r.email).length;
  const view = rawView === "list" ? "list" : "board";
  const tags = [...new Set(all.flatMap((r) => r.tags ?? []))].sort();
  const rows = all
    .filter((r) => !tag || (r.tags ?? []).includes(tag))
    .filter((r) => (show === "revealed" ? r.email : show === "locked" ? !r.email : true))
    .filter((r) => !q || [r.person.latin, r.person.title, r.person.company, r.person.companyDomain].some((v) => v?.toLowerCase().includes(q)));
  const href = (s: Show, withQ = true, v: string = view, tg: string | undefined = tag) =>
    `/leads?${new URLSearchParams({ lang, ...(v === "list" && { view: "list" }), ...(s !== "all" && { show: s }), ...(withQ && q && { q }), ...(tg && { tag: tg }) })}`;
  const stageOptions = STAGES.map((st) => ({ value: st, label: STAGE_LABEL[st][lang] }));

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
            <a href={`/leads/import?lang=${lang}`} className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-medium text-ink outline outline-1 -outline-offset-1 outline-line hover:bg-surface"><Icon name="inbox" size={14} />{t.import}</a>
            <a href={`/leads/new?lang=${lang}`} data-testid="add-lead" className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-medium text-ink outline outline-1 -outline-offset-1 outline-line hover:bg-surface"><Icon name="plus" size={14} />{t.add}</a>
            <a href={`/search?lang=${lang}`} className="flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-[14px] font-medium text-white hover:bg-brand-2"><Icon name="search" size={14} />{t.start}</a>
          </div>
        </div>

        {all.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-[20px] bg-white p-8 outline outline-1 -outline-offset-1 outline-line">
            <span className="flex size-11 items-center justify-center rounded-[12px] bg-mint text-brand"><Icon name="users" size={18} /></span>
            <strong className="text-[17px] text-ink">{t.empty}</strong>
            <span className="text-[14.5px] text-muted">{t.emptySub}</span>
            <span className="text-[14.5px] text-muted">{t.emptyCrm}</span>
          </div>
        ) : (
          <>
            {imported && <p role="status" className="rounded-[12px] bg-success-soft px-4 py-3 text-[14px] text-success-ink">{t.imported(Number(imported), Number(skipped ?? 0))}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <nav aria-label={t.board} className="flex gap-0.5 rounded-[12px] bg-surface p-1">
                {(["board", "list"] as const).map((v) => (
                  <a key={v} href={href(show, true, v)} aria-current={view === v ? "true" : undefined} data-testid={`view-${v}`}
                    className={cx("rounded-[9px] px-3 py-1.5 text-[13px] font-medium", view === v ? "bg-white text-ink shadow-[0_1px_2px_#0000001a]" : "text-muted hover:text-ink")}>{t[v]}</a>
                ))}
              </nav>
              {tags.map((tg) => (
                <a key={tg} href={href(show, true, view, tag === tg ? undefined : tg)} className={cx("rounded-full px-3 py-1.5 text-[12.5px] font-medium", tag === tg ? "bg-brand text-white" : "bg-white text-ink outline outline-1 -outline-offset-1 outline-line")}>#{tg}</a>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form action="/leads" method="get" className="flex h-10 min-w-0 flex-1 basis-[240px] items-center gap-2 rounded-[12px] bg-white px-3 outline outline-1 -outline-offset-1 outline-line sm:max-w-[340px]">
                <input type="hidden" name="lang" value={lang} />
                {view === "list" && <input type="hidden" name="view" value="list" />}
                {tag && <input type="hidden" name="tag" value={tag} />}
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
            ) : view === "board" ? (
              <div className="-mx-4 overflow-x-auto px-4 pb-2" data-testid="board">
                <div className="grid min-w-[1000px] grid-cols-5 gap-3">
                  {STAGES.map((st) => {
                    const col = rows.filter((r) => r.stage === st);
                    return (
                      <section key={st} className="flex flex-col gap-2 rounded-[16px] bg-surface p-2.5">
                        <h2 className="flex items-center justify-between px-1.5 pt-1 text-[13px] font-semibold text-ink">{STAGE_LABEL[st][lang]}<span className="text-subtle">{col.length}</span></h2>
                        {col.map((r) => (
                          <article key={r.id} className="flex flex-col gap-2 rounded-[12px] bg-white p-3 outline outline-1 -outline-offset-1 outline-line">
                            <a href={`/leads/${r.id}?lang=${lang}`} className="flex flex-col gap-0.5">
                              <span className="truncate text-[14px] font-semibold text-ink" dir="auto">{r.person.latin}</span>
                              <span className="truncate text-[12px] text-muted" dir="auto">{[r.person.title, r.person.company].filter(Boolean).join(" · ")}</span>
                            </a>
                            {(r.nextStep || r.nextStepAt) && (
                              <span className={cx("rounded-[8px] px-2 py-1 text-[12px]", isDue(r.nextStepAt) ? "bg-accent-soft text-accent-ink" : "bg-surface-3 text-ink-2")} dir="auto">
                                {t.nextStep}: {r.nextStep ?? "—"}{r.nextStepAt ? ` · ${r.nextStepAt.slice(0, 10)}` : ""}
                              </span>
                            )}
                            {st === "contacted" && isDue(r.followUpAt) && <span className="w-fit rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink">{t.due}</span>}
                            {(r.tags ?? []).length > 0 && <span className="flex flex-wrap gap-1">{r.tags.map((tg) => <span key={tg} className="rounded-full bg-mint px-2 py-0.5 text-[11px] text-brand">#{tg}</span>)}</span>}
                            <form action={updateLeadAction}>
                              <input type="hidden" name="leadId" value={r.id} /><input type="hidden" name="lang" value={lang} />
                              <input type="hidden" name="back" value={href(show)} />
                              <AutoSubmitSelect name="stage" defaultValue={r.stage} options={stageOptions} label={t.head.person}
                                className="h-8 w-full cursor-pointer rounded-[8px] bg-surface-3 px-2 text-[12.5px] text-ink outline-none" />
                            </form>
                          </article>
                        ))}
                      </section>
                    );
                  })}
                </div>
              </div>
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
                            {(r.stage !== "saved" || isDue(r.followUpAt)) && (
                              <span className="flex flex-wrap gap-1 pt-1">
                                {r.stage !== "saved" && <span className="rounded-full bg-mint px-2 py-0.5 text-[11px] font-medium text-brand">{t.stages[r.stage]}</span>}
                                {r.stage === "contacted" && isDue(r.followUpAt) && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink">{t.due}</span>}
                              </span>
                            )}
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

const isDue = (at: string | null) => Boolean(at && new Date(at) <= new Date());
