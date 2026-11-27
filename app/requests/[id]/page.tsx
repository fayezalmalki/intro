import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { SaveLeadButton } from "@/components/app/SaveLeadButton";
import { Badge, Btn, Card, Empty, PageHeader, Steps, Tip } from "@/components/app/ui";
import { SendButton } from "@/components/SendButton";
import { pickLang } from "@/components/site/AuthShell";
import { Icon } from "@/components/site/ui";
import { devVerifyAndGrant, retrySourcing } from "@/lib/actions";
import * as repo from "@/lib/db/repo";
import { SubmitButton } from "@/components/app/SubmitButton";
import { FIT_LABEL, OUTREACH_LABEL } from "@/lib/app-copy";
import { balanceOf } from "@/lib/credits";
import { loadRequestContext } from "@/lib/db/loaders";
import { devToolsEnabled } from "@/lib/env";
import { canReadRequest, pageAccount } from "@/lib/session";
import type { Account, Db, IntroRequest, Pipeline } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Request · intro" };

type Lang = "ar" | "en";

const C = {
  en: {
    steps: ["Your goal", "Confirm", "Find people", "Results", "Reach out"],
    results: (n: number) => (n === 1 ? "1 person worth reaching" : `${n} people worth reaching`),
    version: (v: number) => `Version ${v}`,
    updated: (v: number, by: string) => `We updated your list — version ${v}${by}.`,
    updatedSub: "Anyone you already contacted keeps their status.",
    byAm: (n: string) => ` from ${n}, your account manager`, byTeam: " from the intro team",
    observer: "Your list is ready. Activate sending to reach out under your name.",
    observerPending: "Activation is under review — we'll email you when you can send.",
    observerSub: "Meanwhile, save people and reveal their verified emails.",
    activate: "Activate sending", sending: (cap: number, credits: number) => `Sending is on · ${cap} a day · ${credits} credits`,
    why: "Why them", whyNow: "Why now", sources: "Sources", opener: "Suggested first message",
    send: "Send", sendIntro: "Request intro", sendingNow: "Sending…", linkedin: "LinkedIn", isNew: (v: number) => `New in v${v}`,
    footnote: "Up to 10 messages per request, one per person. Nothing is sent without your choice.",
    searching: "Finding the right people…", searchingSub: "We're mapping companies, finding the decision maker at each, and checking this week's news. Results appear here on their own — usually within a minute.",
    dontWait: "Don't want to wait?", dontWaitSub: "Search companies and decision makers directly.", searchNow: "Search now",
    review: "Your account manager is reviewing your list.", reviewSub: "Matches are ready and being checked before they reach you — usually within a business day.",
    none: "We couldn't find strong matches for this one.", noneSub: "Try naming the role and sector more specifically, or widen the market. You can also search directly.",
    refine: "Refine the request", yourRequest: "Your request",
    stalled: "This is taking longer than usual.", stalledSub: "The search didn't finish. Run it again, or search directly while we look into it.",
    retry: "Run the search again", retrying: "Restarting…",
  },
  ar: {
    steps: ["هدفك", "التأكيد", "البحث", "النتائج", "التواصل"],
    results: (n: number) => n === 1 ? "شخص واحد يستحق التواصل" : n === 2 ? "شخصان يستحقان التواصل" : n <= 10 ? `${n} أشخاص يستحقون التواصل` : `${n} شخصًا يستحقون التواصل`,
    version: (v: number) => `النسخة ${v}`,
    updated: (v: number, by: string) => `حدّثنا قائمتك، النسخة ${v}${by}.`,
    updatedSub: "اللي تواصلت معهم قبل، حالتهم محفوظة كما هي.",
    byAm: (n: string) => ` من ${n}، مدير حسابك`, byTeam: " من فريق انترو",
    observer: "قائمتك جاهزة. فعّل الإرسال عشان تتواصل باسمك.",
    observerPending: "طلب التفعيل قيد المراجعة، ونراسلك أول ما يتفعّل.",
    observerSub: "وفي الوقت نفسه، احفظ الأشخاص واكشف بريدهم الموثّق.",
    activate: "فعّل الإرسال", sending: (cap: number, credits: number) => `الإرسال مفعّل · ${cap} يوميًا · الرصيد ${credits}`,
    why: "ليش هو", whyNow: "ليش الحين", sources: "المصادر", opener: "أول رسالة مقترحة",
    send: "أرسل", sendIntro: "اطلب تعارف", sendingNow: "نرسل…", linkedin: "LinkedIn", isNew: (v: number) => `جديد في النسخة ${v}`,
    footnote: "حتى 10 رسائل لكل طلب، ورسالة وحدة لكل شخص. ما نرسل شيئًا بدون اختيارك.",
    searching: "نبحث الآن عن الأشخاص المناسبين…", searchingSub: "نحدد الجهات، ونلقى صاحب القرار في كل وحدة، ونتحقق من أخبار هذا الأسبوع. النتائج تظهر هنا تلقائيًا، وعادةً خلال دقيقة.",
    dontWait: "ما تبي تنتظر؟", dontWaitSub: "ابحث عن الجهات وأصحاب القرار مباشرة.", searchNow: "ابحث الآن",
    review: "مدير حسابك يراجع قائمتك.", reviewSub: "المطابقات جاهزة وتُراجع قبل ما توصلك، وعادةً خلال يوم عمل.",
    none: "ما لقينا مطابقات قوية لهذا الطلب.", noneSub: "جرّب تحدد المنصب والقطاع بشكل أوضح، أو وسّع السوق. وتقدر تبحث مباشرة.",
    refine: "عدّل الطلب", yourRequest: "طلبك",
    stalled: "البحث تأخر أكثر من المعتاد.", stalledSub: "ما اكتمل البحث. شغّله مرة ثانية، أو ابحث مباشرة.",
    retry: "شغّل البحث مرة ثانية", retrying: "نعيد التشغيل…",
  },
};

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { id } = await params;
  const { lang: l } = await searchParams;
  const account = await pageAccount(`/requests/${id}`);
  const db: Db = await loadRequestContext(id);
  const req = db.requests.find((r) => r.id === id);
  // notFound() rather than a refusal: a refusal would confirm the id exists.
  if (!req || !canReadRequest(account, req.accountId)) notFound();
  if (req.status === "intent_review") redirect(`/requests/${id}/confirm`);

  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const t = C[lang];
  const credits = balanceOf(db, account.id);
  const mine = db.pipelines.filter((p) => p.requestId === id);
  const published = mine.find((p) => p.status === "published");

  const shell = (children: React.ReactNode) => (
    <AppShell account={account} lang={lang} on="requests" credits={credits}>
      <div className="mx-auto flex max-w-[860px] flex-col gap-6">{children}</div>
    </AppShell>
  );

  if (!published) {
    const draft = mine.find((p) => p.status === "draft");
    const managed = account.state === "managed";
    // A self-serve draft with results publishes on sight — this un-sticks
    // requests sourced before auto-publish existed, or whose publish step failed.
    if (!managed && draft && draft.items.some((i) => i.evidence.length > 0) && req.accountId === account.id) {
      await repo.autoPublish(draft.id, "AI");
      redirect(`/requests/${id}?lang=${lang}`);
    }
    const emptyDraft = draft && draft.items.length === 0;
    const stalled = !draft && req.confirmedAt && Date.now() - new Date(req.confirmedAt).getTime() > 5 * 60_000;
    return shell(
      <>
        <Steps steps={t.steps.map((s, i) => ({ label: s, state: i < 2 ? "done" : i === 2 ? (emptyDraft ? "done" : "active") : i === 3 && emptyDraft ? "active" : "pending" }))} />
        {emptyDraft ? (
          <Empty icon="search" title={t.none} body={t.noneSub}>
            <div className="flex flex-wrap gap-2">
              <Btn href={`/new?lang=${lang}&q=${encodeURIComponent(req.rawText)}`} variant="secondary" icon="refresh">{t.refine}</Btn>
              <Btn href={`/search?lang=${lang}&mode=people&run=1&describe=${encodeURIComponent(req.rawText)}`} icon="search">{t.searchNow}</Btn>
            </div>
          </Empty>
        ) : managed ? (
          <PageHeader title={t.review} sub={t.reviewSub} />
        ) : stalled ? (
          <Empty icon="clock" title={t.stalled} body={t.stalledSub}>
            <div className="flex flex-wrap gap-2">
              <form action={retrySourcing}><input type="hidden" name="requestId" value={id} /><SubmitButton pending={t.retrying} icon="refresh">{t.retry}</SubmitButton></form>
              <Btn href={`/search?lang=${lang}&mode=people&run=1&describe=${encodeURIComponent(req.rawText)}`} variant="secondary" icon="search">{t.searchNow}</Btn>
            </div>
          </Empty>
        ) : (
          <>
            {/* Self-serve sourcing publishes itself; refresh until it lands. */}
            <meta httpEquiv="refresh" content="6" />
            <PageHeader title={<span className="flex items-center gap-3"><span className="size-5 animate-spin rounded-full border-2 border-mint border-t-brand" aria-hidden="true" />{t.searching}</span>} sub={t.searchingSub} />
            <Tip icon="search" title={t.dontWait} action={<Btn href={`/search?lang=${lang}&mode=people&run=1&describe=${encodeURIComponent(req.rawText)}`} size="sm" icon="search">{t.searchNow}</Btn>}>{t.dontWaitSub}</Tip>
          </>
        )}
        <RequestCard t={t} req={req} />
      </>,
    );
  }

  const prior = mine.filter((p) => p.version < published.version);
  const priorPeople = new Set(prior.flatMap((p) => p.items.map((i) => i.personId)));
  const sentAny = db.outreach.some((o) => o.requestId === id && o.status !== "none");

  return shell(
    <>
      <Steps steps={t.steps.map((s, i) => ({ label: s, state: i < 3 ? "done" : i === 3 ? (sentAny ? "done" : "active") : sentAny ? "active" : "pending" }))} />
      <PageHeader title={t.results(published.items.length)} sub={<span dir="auto">«{req.rawText}»</span>} actions={published.version > 1 ? <Badge>{t.version(published.version)}</Badge> : undefined} />

      {published.version > 1 && (
        <div data-testid="version-banner">
          <Tip icon="refresh" title={t.updated(published.version, req.assignedAm ? t.byAm(req.assignedAm) : published.source !== "ai_generated" ? t.byTeam : "")}>{t.updatedSub}</Tip>
        </div>
      )}

      <SendStatus t={t} account={account} credits={credits} requestId={id} />

      <ul className="flex flex-col gap-3">
        {published.items.map((item) => (
          <Result key={item.id} t={t} lang={lang} db={db} requestId={id} item={item} published={published} isNew={published.version > 1 && !priorPeople.has(item.personId)} />
        ))}
      </ul>
      <p className="text-[13px] text-subtle">{t.footnote}</p>
    </>,
  );
}

function RequestCard({ t, req }: { t: (typeof C)["en"]; req: IntroRequest }) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <span className="text-[12.5px] font-medium text-subtle">{t.yourRequest}</span>
      <p className="text-[15px] text-ink" dir="auto">«{req.rawText}»</p>
      {req.brief?.summaryAr && <p className="border-t border-line pt-2.5 text-[14px] text-muted" dir="auto">{req.brief.summaryAr}</p>}
    </Card>
  );
}

function SendStatus({ t, account, credits, requestId }: { t: (typeof C)["en"]; account: Account; credits: number; requestId: string }) {
  if (account.state !== "observer") {
    return <p data-testid="send-status" className="flex items-center gap-2 text-[13.5px] text-muted"><Icon name="check-circle" size={14} className="text-brand" />{t.sending(account.dailyCap, credits)}</p>;
  }
  const action = devToolsEnabled ? (
    // Development shortcut only — never in a deploy.
    <form action={devVerifyAndGrant}>
      <input type="hidden" name="requestId" value={requestId} />
      <button type="submit" data-testid="activate-send" className="flex h-9 cursor-pointer items-center rounded-full bg-brand px-4 text-[13.5px] font-medium text-white">{t.activate}</button>
    </form>
  ) : account.activationRequestedAt ? undefined : (
    <Btn href={`/activate?next=${encodeURIComponent(`/requests/${requestId}`)}`} size="sm">{t.activate}</Btn>
  );
  return <Tip icon="shield-check" tone="sand" title={account.activationRequestedAt ? t.observerPending : t.observer} action={action}>{t.observerSub}</Tip>;
}

function Result({ t, lang, db, requestId, item, published, isNew }: {
  t: (typeof C)["en"]; lang: Lang; db: Db; requestId: string; item: Pipeline["items"][number]; published: Pipeline; isNew: boolean;
}) {
  const person = db.people.find((p) => p.id === item.personId);
  if (!person) return null;
  const out = db.outreach.find((o) => o.requestId === requestId && o.personId === item.personId);
  const fit = FIT_LABEL[item.fit] ?? FIT_LABEL.possible;
  const sent = out && out.status !== "none";
  const intro = person.openToIntros;
  return (
    <Card as="li" className="flex flex-col gap-4 p-5" >
      <div data-testid="result" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint text-[15px] font-semibold text-brand">{person.latin[0]}</span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <strong data-testid="person-name" className="font-latin text-[16px] font-semibold text-ink" dir="ltr">{person.latin}</strong>
                {isNew && <span data-testid="new-in-version"><Badge tone="accent">{t.isNew(published.version)}</Badge></span>}
              </span>
              <span className="text-[13.5px] text-muted" dir="auto">{person.title} · {person.company}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sent && <span data-testid="outreach"><Badge tone="brand" dot>{OUTREACH_LABEL[out.status]?.[lang] ?? out.status}</Badge></span>}
            <Badge tone={fit.tone} dot>{fit[lang]}</Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-[12px] bg-surface-3 p-3">
            <span className="text-[12px] font-medium text-subtle">{t.why}</span>
            <p className="text-[14px] leading-[21px] text-ink rtl:leading-[24px]" dir="auto">{item.why}</p>
          </div>
          {item.whyNow && !/^[\s—-]*$/.test(item.whyNow) && (
            <div className="flex flex-col gap-1 rounded-[12px] bg-surface-3 p-3">
              <span className="text-[12px] font-medium text-subtle">{t.whyNow}</span>
              <p className="text-[14px] leading-[21px] text-ink rtl:leading-[24px]" dir="auto">{item.whyNow}</p>
            </div>
          )}
        </div>

        {item.evidence.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-medium text-subtle">{t.sources}</span>
            {item.evidence.slice(0, 4).map((e) => (
              <a key={e.url} href={e.url} target="_blank" rel="noreferrer" className="flex max-w-[260px] items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[12px] text-ink-2 hover:bg-hover">
                <Icon name="link" size={11} /><span className="truncate" dir="auto">{e.title}</span>
              </a>
            ))}
          </div>
        )}

        {item.opener && (
          <details className="group rounded-[12px] bg-surface-2 px-3.5 py-2.5">
            <summary className="flex cursor-pointer items-center justify-between text-[13px] font-medium text-ink-2">
              <span className="flex items-center gap-1.5"><Icon name="sparkles" size={13} className="text-accent" />{t.opener}</span>
              <Icon name="chevron-down" size={13} className="transition-transform group-open:rotate-180" />
            </summary>
            <p className="pt-2 text-[14px] leading-[22px] text-ink [unicode-bidi:plaintext] rtl:leading-[25px]">{item.opener}</p>
          </details>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5">
          <div className="flex flex-wrap items-center gap-2">
            {person.linkedinUrl && <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-brand" dir="ltr">{t.linkedin} ↗</a>}
            <SaveLeadButton lang={lang} person={{ name: person.latin, title: person.title, company: person.company, profileUrl: person.linkedinUrl ?? undefined }} />
          </div>
          {sent ? (
            <Badge tone="neutral">{out.channel === "intro" ? (lang === "ar" ? "عبر انترو" : "Via intro") : lang === "ar" ? "تواصل مباشر" : "Direct"}</Badge>
          ) : (
            <SendButton requestId={requestId} personId={item.personId} channel={intro ? "intro" : item.channel} body={item.opener}
              label={intro ? t.sendIntro : t.send} pendingLabel={t.sendingNow} />
          )}
        </div>
      </div>
    </Card>
  );
}
