import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { Badge, Btn, Card, Empty, PageHeader, Starter, Tip } from "@/components/app/ui";
import { pickLang } from "@/components/site/AuthShell";
import { Icon } from "@/components/site/ui";
import { GOAL_LABEL, REQUEST_STATUS } from "@/lib/app-copy";
import { balanceOf } from "@/lib/credits";
import { loadMyRequests } from "@/lib/db/loaders";
import { presetHref } from "@/lib/search/presets";
import { pageAccount } from "@/lib/session";
import { ar as arDict } from "@/lib/site/ar";
import { en as enDict } from "@/lib/site/en";
import type { Db } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Requests · intro" };

const C = {
  en: {
    title: "Your requests", sub: "Every goal you've described, and where it stands.", newReq: "New request",
    open: "Open", people: (n: number) => `${n} people`, sent: (n: number) => `${n} contacted`,
    kpis: { open: "Open", matched: "People found", sent: "Contacted", replies: "Reply rate" },
    empty: "No requests yet", emptySub: "Describe a goal in one sentence — we'll find the people, explain why each matters now, and draft the first message.",
    write: "Write a goal", orStart: "Or start from one of these",
    observer: "Activate sending to reach out under your name.", observerPending: "Activation is under review — we'll email you.",
    observerSub: "You can still create requests, see matches, and reveal verified emails.", activate: "Activate sending",
  },
  ar: {
    title: "طلباتك", sub: "كل هدف كتبته، ووين وصل.", newReq: "طلب جديد",
    open: "افتح", people: (n: number) => `${n} أشخاص`, sent: (n: number) => `تواصلت مع ${n}`,
    kpis: { open: "مفتوحة", matched: "أشخاص مرشّحون", sent: "تم التواصل", replies: "نسبة الرد" },
    empty: "ما عندك طلبات بعد", emptySub: "اكتب هدفك في جملة، ونلقى لك الأشخاص، ونوضح ليش كل واحد مهم الحين، ونكتب أول رسالة.",
    write: "اكتب هدفًا", orStart: "أو ابدأ من واحد من هذي",
    observer: "فعّل الإرسال عشان تتواصل باسمك.", observerPending: "طلب التفعيل قيد المراجعة، ونراسلك أول ما يتفعّل.",
    observerSub: "تقدر من الحين تنشئ الطلبات وتشوف المطابقات وتكشف البريد الموثّق.", activate: "فعّل الإرسال",
  },
};

export default async function MyRequestsPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang: l } = await searchParams;
  const account = await pageAccount("/requests");
  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const t = C[lang];
  const db = await loadMyRequests(account.id);
  const rows = [...db.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const credits = balanceOf(db, account.id);
  const dict = lang === "ar" ? arDict : enDict;

  return (
    <AppShell account={account} lang={lang} on="requests" credits={credits}>
      <div className="flex flex-col gap-6">
        <PageHeader title={t.title} sub={t.sub} actions={<Btn href={`/new?lang=${lang}`} icon="plus">{t.newReq}</Btn>} />

        {account.state === "observer" && (
          <Tip icon="shield-check" tone="sand" title={account.activationRequestedAt ? t.observerPending : t.observer}
            action={account.activationRequestedAt ? undefined : <Btn href="/activate" size="sm">{t.activate}</Btn>}>
            {t.observerSub}
          </Tip>
        )}

        {rows.length === 0 ? (
          <Empty icon="file-text" title={t.empty} body={t.emptySub}>
            <Btn href={`/new?lang=${lang}`} icon="sparkles">{t.write}</Btn>
            <span className="pt-2 text-[13px] font-medium text-subtle">{t.orStart}</span>
            <ul className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {dict.useCases.items.map((u, i) => <li key={u.id}><Starter href={presetHref(u.id, lang)} icon={u.icon} title={u.name} body={u.example} tone={i} /></li>)}
            </ul>
          </Empty>
        ) : (
          <>
            <Kpis db={db} t={t} />
            <ul className="flex flex-col gap-2">
              {rows.map((r) => {
                const s = REQUEST_STATUS[r.status];
                const matched = matchedIn(db, r.id);
                const contacted = db.outreach.filter((o) => o.requestId === r.id && o.status !== "none").length;
                return (
                  <li key={r.id}>
                    <a data-testid="request-row" href={r.status === "intent_review" ? `/requests/${r.id}/confirm?lang=${lang}` : `/requests/${r.id}?lang=${lang}`}
                      className="flex flex-wrap items-center gap-3 rounded-[16px] bg-white p-4 outline outline-1 -outline-offset-1 outline-line transition-colors hover:bg-surface-3">
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-[15px] font-medium text-ink" dir="auto">{r.brief?.summaryAr ?? r.rawText}</span>
                        <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-subtle">
                          {r.brief && <Badge>{GOAL_LABEL[r.brief.goalType]?.[lang] ?? r.brief.goalType}</Badge>}
                          {matched > 0 && <span>{t.people(matched)}</span>}
                          {contacted > 0 && <span>· {t.sent(contacted)}</span>}
                          <span dir="ltr">· {r.createdAt.slice(0, 10)}</span>
                        </span>
                      </span>
                      <Badge tone={s.tone} dot>{s[lang]}</Badge>
                      <Icon name="arrow-right" flip className="text-subtle" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Kpis({ db, t }: { db: Db; t: (typeof C)["en"] }) {
  const open = db.requests.filter((r) => r.status !== "closed").length;
  const matched = db.pipelines.filter((p) => p.status === "published").reduce((n, p) => n + p.items.length, 0);
  const sent = db.outreach.filter((o) => o.status !== "none");
  const answered = sent.filter((o) => ["replied", "accepted", "declined"].includes(o.status)).length;
  const items = [
    { k: t.kpis.open, v: String(open) },
    { k: t.kpis.matched, v: String(matched) },
    { k: t.kpis.sent, v: String(sent.length) },
    { k: t.kpis.replies, v: sent.length ? `${Math.round((answered / sent.length) * 100)}%` : "—" },
  ];
  return (
    <Card className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x rtl:sm:divide-x-reverse">
      {items.map((i) => (
        <div key={i.k} className="flex flex-col gap-1 p-4">
          <span className="text-[12.5px] text-subtle">{i.k}</span>
          <span className="font-display text-[26px] font-medium tracking-[-0.8px] text-ink">{i.v}</span>
        </div>
      ))}
    </Card>
  );
}

function matchedIn(db: Db, requestId: string): number {
  const published = db.pipelines
    .filter((p) => p.requestId === requestId && p.status === "published")
    .sort((a, b) => b.version - a.version)[0];
  return published?.items.length ?? 0;
}
