import { balanceOf } from "./credits";
import type { Db, IntroRequest } from "./types";

export type StageState = "done" | "active" | "blocked" | "pending";

export interface StageDetail {
  label: string;
  value: string;
  tone?: "normal" | "good" | "warn" | "bad";
}

export interface Stage {
  key: string;
  title: string;
  state: StageState;
  summary: string;
  at?: string;
  details: StageDetail[];
}

export interface PipelineView {
  request: IntroRequest;
  stages: Stage[];
  /** Index of the stage the request is sitting in right now. */
  currentIndex: number;
}

/** Enum keys are storage, not copy — this UI is Arabic-first. */
const GOAL_LABEL: Record<string, string> = {
  job: "وظيفة",
  sales: "مبيعات",
  partnership: "شراكة",
  investment: "استثمار",
  person: "شخص محدد",
};

const SOURCE_LABEL: Record<string, string> = {
  ai_generated: "مُولّدة آليًا",
  manual: "يدوية",
  imported_csv: "من ملف مرفوع",
  pasted: "من صفوف ملصقة",
  from_list: "من قائمة جاهزة",
};

const AR = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
const ar = (n: number | string) =>
  String(n).split("").map((d) => (/\d/.test(d) ? AR[+d] : d)).join("");

function time(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return `${ar(d.getHours())}:${ar(String(d.getMinutes()).padStart(2, "0"))}`;
}

/**
 * Derives the whole journey of one request as an ordered list of stages.
 *
 * The state is otherwise scattered — a status on the request, versions on
 * pipelines, decisions on items, verdicts on send attempts — so nobody can see
 * where a request actually is without opening four screens. This assembles it
 * from what already exists; it stores nothing new.
 *
 * Pure over `Db`, like lib/gate.ts, so it survives the Postgres port unchanged.
 */
const UNASSIGNED = "غير مُسند";

export function buildPipelineView(db: Db, requestId: string): PipelineView | undefined {
  const request = db.requests.find((r) => r.id === requestId);
  if (!request) return undefined;

  const pipelines = db.pipelines
    .filter((p) => p.requestId === requestId)
    .sort((a, b) => a.version - b.version);
  const published = pipelines.find((p) => p.status === "published");
  const draft = pipelines.find((p) => p.status === "draft");
  const latest = draft ?? published ?? pipelines[pipelines.length - 1];

  const outreach = db.outreach.filter((o) => o.requestId === requestId && o.status !== "none");
  const attempts = db.sendAttempts.filter((a) => a.requestId === requestId);
  const refused = attempts.filter((a) => a.result === "refused");
  const account = db.accounts.find((a) => a.id === request.accountId);

  const brief = request.brief;
  const stages: Stage[] = [];

  // 1 — intake
  stages.push({
    key: "intake",
    title: "الطلب",
    state: "done",
    at: time(request.createdAt),
    summary: `«${request.rawText}»`,
    details: [{ label: "مقدّم الطلب", value: request.requesterName }],
  });

  // 2 — intent
  stages.push({
    key: "intent",
    title: "الفهم",
    state: request.confirmedAt ? "done" : "active",
    at: time(request.confirmedAt),
    summary: brief
      ? brief.summaryAr
      : "لم يُستخرج ملخص بعد.",
    details: brief
      ? [
          { label: "الهدف", value: GOAL_LABEL[brief.goalType] ?? brief.goalType },
          { label: "الأدوار", value: brief.targetRoles.join("، ") || "—" },
          { label: "القطاع", value: brief.industries.join("، ") || "—" },
          { label: "يستثني", value: brief.exclusions.join("، ") || "—" },
          {
            label: "الاستخراج",
            value: brief.extractedBy === "claude" ? "Claude" : "قواعد محلية",
            tone: brief.extractedBy === "claude" ? "good" : "warn",
          },
          { label: "الثقة", value: `${ar(Math.round(brief.confidence * 100))}٪` },
        ]
      : [],
  });

  // 3 — sourcing
  const overdue = !published && Date.now() > new Date(request.dueAt).getTime();
  stages.push({
    key: "sourcing",
    title: "التجهيز",
    state: pipelines.length === 0 ? (request.confirmedAt ? "active" : "pending") : "done",
    at: time(pipelines[0]?.createdAt),
    summary:
      pipelines.length === 0
        ? "لم تُبنَ قائمة بعد."
        : `${ar(pipelines.length)} نسخة · مدير الحساب ${request.assignedAm ?? UNASSIGNED}`,
    details: [
      { label: "مدير الحساب", value: request.assignedAm ?? UNASSIGNED },
      {
        label: "الموعد",
        value: overdue ? "تجاوز الوقت" : new Date(request.dueAt).toISOString().slice(0, 10),
        tone: overdue ? "bad" : "normal",
      },
    ],
  });

  // 4 — review
  const items = latest?.items ?? [];
  const approved = items.filter((i) => i.status === "approved").length;
  const removed = items.filter((i) => i.status === "removed").length;
  const noEvidence = items.filter((i) => i.evidence.length === 0 && i.status !== "removed").length;
  stages.push({
    key: "review",
    title: "المراجعة",
    state: !latest ? "pending" : draft ? (noEvidence > 0 ? "blocked" : "active") : "done",
    summary: latest
      ? `النسخة ${ar(latest.version)} · ${ar(approved)} معتمدين من ${ar(items.length)}`
      : "لا توجد قائمة للمراجعة.",
    details: latest
      ? [
          { label: "المصدر", value: SOURCE_LABEL[latest.source] ?? latest.source },
          { label: "معتمد", value: ar(approved), tone: "good" },
          { label: "مُزال", value: ar(removed) },
          {
            label: "بدون مصدر موثّق",
            value: ar(noEvidence),
            tone: noEvidence > 0 ? "bad" : "normal",
          },
        ]
      : [],
  });

  // 5 — publish
  stages.push({
    key: "publish",
    title: "النشر",
    state: published ? "done" : "pending",
    at: time(published?.publishedAt),
    summary: published
      ? `النسخة ${ar(published.version)} منشورة · ${ar(published.items.length)} أشخاص`
      : "لم تُنشر أي نسخة بعد.",
    details: pipelines.map((p) => ({
      label: `النسخة ${ar(p.version)}`,
      value: `${p.createdBy} · ${p.status === "published" ? "منشورة" : p.status === "draft" ? "مسودة" : "استُبدلت"}`,
      tone: p.status === "published" ? ("good" as const) : ("normal" as const),
    })),
  });

  // 6 — outreach
  const capLeft = account ? account.dailyCap - attempts.filter((a) => a.result === "allowed").length : 0;
  stages.push({
    key: "outreach",
    title: "التواصل",
    state: outreach.length > 0 ? "active" : published ? "pending" : "pending",
    summary:
      outreach.length > 0
        ? `${ar(outreach.length)} رسالة · ${ar(refused.length)} رُفضت عند البوابة`
        : "لم يبدأ التواصل.",
    details: [
      { label: "أُرسلت", value: ar(outreach.filter((o) => o.status === "sent").length) },
      { label: "ردود", value: ar(outreach.filter((o) => o.status === "replied").length), tone: "good" },
      {
        label: "رفض البوابة",
        value: refused.length ? refusalSummary(refused.flatMap((a) => a.gateFailures)) : "—",
        tone: refused.length ? "warn" : "normal",
      },
      { label: "المتبقي اليوم", value: account ? ar(Math.max(0, capLeft)) : "—" },
      { label: "الرصيد", value: account ? ar(balanceOf(db, account.id)) : "—" },
    ],
  });

  // 7 — replies (not built)
  stages.push({
    key: "replies",
    title: "الردود",
    state: "pending",
    summary: "صندوق الردود لم يُبنَ بعد.",
    details: [{ label: "الحالة", value: "قادم", tone: "warn" }],
  });

  const currentIndex = Math.max(
    0,
    stages.findIndex((s) => s.state === "active" || s.state === "blocked"),
  );

  return { request, stages, currentIndex };
}

function refusalSummary(failures: string[]): string {
  const counts = new Map<string, number>();
  for (const f of failures) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts.entries()].map(([f, n]) => `${f} ×${ar(n)}`).join("، ");
}
