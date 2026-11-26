import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Badge, Card, PageHeader, Steps, Tip } from "@/components/app/ui";
import { pickLang } from "@/components/site/AuthShell";
import { confirmBrief } from "@/lib/actions";
import { GOAL_LABEL } from "@/lib/app-copy";
import * as repo from "@/lib/db/repo";
import { loadRequestContext } from "@/lib/db/loaders";
import { canReadRequest, pageAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirm · intro" };

const C = {
  en: {
    eyebrow: "Step 2 · Confirm", title: "Here's what we understood",
    sub: "Edit the summary if it's off. We only start looking once you confirm.",
    summary: "Summary", goal: "Goal", roles: "Roles", sectors: "Sectors", markets: "Markets", excludes: "Excludes",
    confirm: "Looks right — find people", confirming: "Starting the search…",
    edit: "Start over", steps: ["Your goal", "Confirm", "Find people", "Results"],
    tip: "Results usually arrive within a minute. You'll see each person with why they fit, why now, and a first line.",
    cost: (n: number) => `Running this request uses 5 credits — refunded if we find nobody. You have ${n}.`,
    by: (c: boolean) => (c ? "Understood by Claude" : "Understood by keyword rules — check it carefully"),
    original: "You wrote",
  },
  ar: {
    eyebrow: "الخطوة ٢ · التأكيد", title: "هذا اللي فهمناه",
    sub: "عدّل الملخص إذا فيه شيء غير دقيق. ما نبدأ البحث إلا بعد تأكيدك.",
    summary: "الملخص", goal: "الهدف", roles: "المناصب", sectors: "القطاعات", markets: "الأسواق", excludes: "يستثني",
    confirm: "تمام، ابحث عن الأشخاص", confirming: "نبدأ البحث…",
    edit: "ابدأ من جديد", steps: ["هدفك", "التأكيد", "البحث", "النتائج"],
    tip: "النتائج توصل عادةً خلال دقيقة، ومع كل شخص: ليش يناسبك، وليش الحين، وأول سطر.",
    cost: (n: number) => `تشغيل هذا الطلب يستخدم ٥ أرصدة، وتُسترجع إذا ما لقينا أحدًا. رصيدك ${n}.`,
    by: (c: boolean) => (c ? "فهمه Claude" : "فُهم بقواعد الكلمات المفتاحية، راجعه بعناية"),
    original: "اللي كتبته",
  },
};

export default async function ConfirmPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { id } = await params;
  const { lang: l } = await searchParams;
  const account = await pageAccount(`/requests/${id}/confirm`);
  const req = (await loadRequestContext(id)).requests.find((r) => r.id === id);
  if (!req?.brief || !canReadRequest(account, req.accountId)) notFound();
  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const t = C[lang];
  const b = req.brief;
  const credits = await repo.creditBalance(account.id);

  const rows = [
    { k: t.roles, v: b.targetRoles },
    { k: t.sectors, v: b.industries },
    { k: t.markets, v: b.geos },
    { k: t.excludes, v: b.exclusions },
  ].filter((r) => r.v.length > 0);

  return (
    <AppShell account={account} lang={lang} on="requests" credits={credits}>
      <div className="mx-auto flex max-w-[760px] flex-col gap-6">
        <Steps steps={t.steps.map((s, i) => ({ label: s, state: i < 1 ? "done" : i === 1 ? "active" : "pending" }))} />
        <PageHeader eyebrow={t.eyebrow} title={t.title} sub={t.sub} />

        <Card className="p-5 sm:p-6">
          <form action={confirmBrief} className="flex flex-col gap-5">
            <input type="hidden" name="requestId" value={req.id} />
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-subtle">{t.original}</span>
              <p className="text-[15px] text-ink" dir="auto">«{req.rawText}»</p>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-subtle">{t.summary}</span>
              <textarea name="summaryAr" rows={3} defaultValue={b.summaryAr} dir="auto"
                className="w-full rounded-[14px] bg-surface-2 p-3.5 text-[15.5px] leading-[25px] text-ink outline-none focus:outline-2 focus:outline-brand" />
            </label>
            <dl className="flex flex-col gap-3 border-t border-line pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <dt className="w-24 text-[13px] text-subtle">{t.goal}</dt>
                <dd><Badge tone="brand">{GOAL_LABEL[b.goalType]?.[lang] ?? b.goalType}</Badge></dd>
              </div>
              {rows.map((r) => (
                <div key={r.k} className="flex flex-wrap items-center gap-3">
                  <dt className="w-24 text-[13px] text-subtle">{r.k}</dt>
                  <dd className="flex flex-wrap gap-1.5">{r.v.map((x) => <Badge key={x}>{x}</Badge>)}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <span className="text-[12.5px] text-subtle">{t.by(b.extractedBy === "claude")}</span>
              <div className="flex items-center gap-2">
                <a href={`/new?lang=${lang}&q=${encodeURIComponent(req.rawText)}`} className="text-[13.5px] font-medium text-muted hover:text-ink">{t.edit}</a>
                <SubmitButton pending={t.confirming} icon="arrow-right" testId="confirm-brief">{t.confirm}</SubmitButton>
              </div>
            </div>
          </form>
        </Card>
        <Tip icon="sparkles" tone={credits < 5 ? "peach" : "mint"} action={credits < 5 ? <a href={`/billing?lang=${lang}`} className="text-[13.5px] font-medium text-brand">{lang === "ar" ? "اشحن رصيدك" : "Top up"}</a> : undefined}>{t.cost(credits)}</Tip>
        <Tip icon="clock">{t.tip}</Tip>
      </div>
    </AppShell>
  );
}
