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
    sub: "Check the picks. Anything off? Edit them — we only start looking once you confirm.",
    summary: "Summary", goal: "Goal", roles: "Roles", sectors: "Sectors", markets: "Markets", excludes: "Excludes",
    confirm: "Looks right — find people", confirming: "Starting the search…",
    edit: "Edit picks", steps: ["Your goal", "Confirm", "Find people", "Results"],
    tip: "Results usually arrive within a minute. You'll see each person with why they fit, why now, and a first line.",
    cost: (n: number) => `Running this request uses 5 credits — refunded if we find nobody. You have ${n}.`,
    by: (c: boolean) => (c ? "Built from your picks — edit anything that's off" : "Check this carefully before you run it"),
    original: "You wrote",
    vague: "This goal is quite broad. Add the sector, the role, or what you want from them — e.g. \"partnerships with Saudi banks for an open-banking app\" — so the results are worth the credits.",
    refine: "Make it more specific",
    unavailable: "Sourcing is unavailable right now, so we didn't run this request. Your credits were returned — try again shortly, or search directly.",
  },
  ar: {
    eyebrow: "الخطوة 2 · التأكيد", title: "هذا اللي فهمناه",
    sub: "راجع الاختيارات، وإذا فيه شيء غير دقيق عدّله. ما نبدأ البحث إلا بعد تأكيدك.",
    summary: "الملخص", goal: "الهدف", roles: "المناصب", sectors: "القطاعات", markets: "الأسواق", excludes: "يستثني",
    confirm: "تمام، ابحث عن الأشخاص", confirming: "نبدأ البحث…",
    edit: "عدّل الاختيارات", steps: ["هدفك", "التأكيد", "البحث", "النتائج"],
    tip: "النتائج توصل عادةً خلال دقيقة، ومع كل شخص: ليش يناسبك، وليش الحين، وأول سطر.",
    cost: (n: number) => `تشغيل هذا الطلب يستخدم 5 رصيد، ويرجع لك إذا ما لقينا أحد. رصيدك ${n}.`,
    by: (c: boolean) => (c ? "مبني من اختياراتك، عدّل أي شي مو دقيق" : "راجعه بعناية قبل التشغيل"),
    original: "اللي كتبته",
    vague: "هدفك عام شوي. أضف القطاع أو المنصب أو وش تبي منهم، مثل: «شراكات مع البنوك السعودية لتطبيق Open Banking»، عشان تطلع النتائج تستاهل الرصيد.",
    refine: "خلّه أدق",
    unavailable: "البحث غير متاح الحين، فما شغّلنا الطلب ورجّعنا رصيدك. جرّب بعد شوي، أو ابحث مباشرة.",
  },
};

export default async function ConfirmPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string; unavailable?: string }> }) {
  const { id } = await params;
  const { lang: l, unavailable } = await searchParams;
  const account = await pageAccount(`/requests/${id}/confirm`);
  const req = (await loadRequestContext(id)).requests.find((r) => r.id === id);
  if (!req?.brief || !canReadRequest(account, req.accountId)) notFound();
  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const t = C[lang];
  const b = req.brief;
  const credits = await repo.creditBalance(account.id);
  // A one- or two-word goal with nothing but a role ("شراكات") sources poorly.
  const vague = b.extractedBy !== "form" && ((b.confidence ?? 1) < 0.5 || (req.rawText.trim().split(/\s+/).length < 3 && b.industries.length === 0));

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
        {unavailable && <Tip icon="clock" tone="peach">{t.unavailable}</Tip>}
        {vague && (
          <Tip icon="target" tone="sand" action={<a href={`/new?lang=${lang}&edit=${req.id}`} className="text-[13.5px] font-medium text-brand">{t.refine}</a>}>{t.vague}</Tip>
        )}

        <Card className="p-5 sm:p-6">
          <form action={confirmBrief} className="flex flex-col gap-5">
            <input type="hidden" name="requestId" value={req.id} />
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-subtle">{t.original}</span>
              <p className="text-[15px] text-ink" dir="auto">«{req.rawText}»</p>
            </div>
            {/* Read-only: the search runs on the picks below, so editing a sentence
                here would change nothing. "Edit picks" is the way to change it. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-subtle">{t.summary}</span>
              <p data-testid="brief-summary" className="rounded-[14px] bg-surface-2 p-3.5 text-[15.5px] leading-[25px] text-ink" dir="auto">{b.summaryAr}</p>
            </div>
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
              <span className="text-[12.5px] text-subtle">{t.by(b.extractedBy !== "rules")}</span>
              <div className="flex items-center gap-2">
                <a href={`/new?lang=${lang}&edit=${req.id}`} data-testid="edit-picks" className="flex h-10 items-center rounded-full bg-white px-4 text-[13.5px] font-medium text-ink outline outline-1 -outline-offset-1 outline-line hover:bg-surface">{t.edit}</a>
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
