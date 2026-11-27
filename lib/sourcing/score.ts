import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Brief, Evidence, Fit, GoalType, PipelineItem } from "../types";
import type { Company, FoundPerson, Signal } from "./provider";
import { LEADERSHIP, seniorityOf, titleMatches, type SearchPlan } from "./vocabulary";

/**
 * Turns sourced candidates into reason-first pipeline rows.
 *
 * The one rule both paths keep: a row may cite only URLs we actually fetched
 * for that person — their profile and their company's signals. Anything else
 * the model writes is dropped, so the "no evidence → cannot approve" gate
 * (lib/sourcing/fixtures.ts canApprove) stays meaningful.
 */

export interface Candidate {
  /** Stable key for the run: the profile URL, else name@domain. */
  key: string;
  person: FoundPerson;
  company: Company;
  signals: Signal[];
}

export type ScoredItem = Omit<PipelineItem, "id" | "personId"> & { candidateKey: string };

export const MAX_ITEMS = 8;
const PER_COMPANY = 2;

type Timing = "high" | "medium" | "low" | "none";
const TIMING_LABEL: Record<Timing, string> = { high: "عالية", medium: "متوسطة", low: "منخفضة", none: "غير معروف" };

/** The rubric from docs/01-mvp-plan.md: `strong` needs a live timing signal. */
function capFit(fit: Fit, timing: Timing): Fit {
  if (timing === "none" || timing === "low") return fit === "strong" ? "medium" : fit;
  return fit;
}

function allowedEvidence(c: Candidate): Evidence[] {
  const out: Evidence[] = [];
  if (c.person.profileUrl) {
    out.push({
      url: c.person.profileUrl,
      title: `${c.person.title} — ${c.person.company || c.company.name}`,
      source: "linkedin.com",
      date: "",
      assertedBy: "ai",
    });
  }
  for (const s of c.signals) {
    out.push({ url: s.url, title: s.title, source: s.source, date: s.date ?? "", assertedBy: "ai" });
  }
  return out;
}

function timingFromSignals(signals: Signal[], now = Date.now()): Timing {
  const ages = signals
    .map((s) => (s.date ? (now - new Date(s.date).getTime()) / 86_400_000 : Infinity))
    .filter((d) => d >= 0);
  const newest = Math.min(Infinity, ...ages);
  if (newest <= 45) return "high";
  if (newest <= 120) return "medium";
  if (newest <= 365) return "low";
  return "none";
}

// ── Rules (no API key, or Claude declined) ─────────────────────

const LEAD_WITH: Record<GoalType, string> = {
  sales: "مشكلة محددة تحلّها لقطاعهم، بالأرقام، لا عرض منتج عام.",
  job: "إنجاز محدد في دور قريب من فريقه، وأثره بالأرقام.",
  partnership: "قيمة واضحة للطرفين، وحالة استخدام واحدة.",
  investment: "الجر والأرقام قبل الفكرة.",
  person: "سبب واضح ومختصر للتواصل.",
};
const AVOID: Record<GoalType, string> = {
  sales: "طلب اجتماع بدون سياق.",
  job: "إرسال السيرة الذاتية كأول رسالة.",
  partnership: "عرض شراكة عام بدون حالة محددة.",
  investment: "إرسال عرض تقديمي كامل كأول رسالة.",
  person: "الرسائل الطويلة.",
};

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

function opener(goal: GoalType, c: Candidate): string {
  const hi = `هلا ${firstName(c.person.name)}،`;
  const at = c.company.name;
  const hook = c.signals[0] ? ` تابعت «${c.signals[0].title}».` : "";
  switch (goal) {
    case "sales":
      return `${hi}${hook} نشتغل مع جهات في نفس قطاع ${at} على مشكلة أعتقد أنها قريبة منكم، وحبيت أشاركك ملخصًا قصيرًا إذا يناسبك.`;
    case "job":
      return `${hi}${hook} أتابع اللي تبنونه في ${at}، وعندي خبرة قريبة من فريقك. حبيت أتواصل معك مباشرة إذا فيه دور قادم يناسب.`;
    case "partnership":
      return `${hi}${hook} أعتقد فيه مساحة شراكة واضحة بيننا وبين ${at}، وعندي حالة استخدام محددة أحب أعرضها عليك باختصار.`;
    case "investment":
      return `${hi}${hook} نبني منتجًا في مرحلة مبكرة وعندنا جر مبدئي، وحبيت أشاركك ملخصًا قصيرًا إذا كان ضمن اهتماماتكم.`;
    default:
      return `${hi}${hook} حبيت أتواصل معك مباشرة بخصوص ${at}.`;
  }
}

export function rulesScore(brief: Brief, plan: SearchPlan, candidates: Candidate[]): ScoredItem[] {
  const ranked = candidates
    .map((c) => {
      const lead = LEADERSHIP.includes(seniorityOf(c.person.title));
      const match = titleMatches(c.person.title, plan.titles);
      const timing = timingFromSignals(c.signals);
      const score = (match ? 3 : 0) + (lead ? 2 : 0) + (timing === "high" ? 2 : timing === "medium" ? 1 : 0);
      return { c, match, lead, timing, score };
    })
    .filter((x) => x.match || x.lead)
    .sort((a, b) => b.score - a.score)
    // At most two per company, so one large employer cannot fill the list.
    .filter((x, _i, all) => all.filter((y) => companyKey(y.c.company) === companyKey(x.c.company)).indexOf(x) < PER_COMPANY)
    .slice(0, MAX_ITEMS);

  return ranked.map(({ c, match, lead, timing }, i) => {
    const evidence = allowedEvidence(c);
    const fit: Fit = capFit(match && lead && timing === "high" ? "strong" : match ? "medium" : "possible", timing);
    return {
      candidateKey: c.key,
      rank: i + 1,
      fit,
      thin: c.signals.length === 0,
      why: `${c.person.title} في ${c.company.name}${match ? "، والمسمى من أقرب الأدوار لهدفك." : "، وموقعه قيادي وقريب من القرار."}`,
      whyNow: c.signals[0]
        ? `${c.signals[0].title}${c.signals[0].date ? ` (${c.signals[0].date})` : ""}.`
        : "ما لقينا خبرًا حديثًا عن الشركة، فلا يوجد سياق توقيت.",
      roleRelevance: match ? "عالية" : "متوسطة",
      companyRelevance: "عالية",
      timing: TIMING_LABEL[timing],
      leadWith: LEAD_WITH[brief.goalType],
      avoid: AVOID[brief.goalType],
      opener: opener(brief.goalType, c),
      channel: "linkedin",
      status: "proposed",
      evidence,
      generatedBy: "ai",
    };
  });
}

// ── Claude ─────────────────────────────────────────────────────

const PickSchema = z.object({
  picks: z.array(z.object({
    candidateId: z.string(),
    fit: z.enum(["strong", "medium", "possible"]),
    timing: z.enum(["high", "medium", "low", "none"]),
    why: z.string(),
    whyNow: z.string(),
    leadWith: z.string(),
    avoid: z.string(),
    opener: z.string(),
    evidenceUrls: z.array(z.string()),
  })),
});

const SYSTEM = `أنت محلل في منصة Intro السعودية. تستقبل هدف شخص يريد الوصول إلى أصحاب قرار،
وقائمة مرشحين حقيقيين مع أدلة جُمعت لكل واحد (ملفه المهني وأخبار شركته).

اختر حتى ${MAX_ITEMS} مرشحين الأقرب للهدف، مرتبين من الأقوى، بحد أقصى اثنين من نفس الشركة،
واكتب لكل واحد بالعربي:
- why: لماذا هذا الشخص تحديدًا، في جملة.
- whyNow: لماذا الآن، مبنيًا على خبر مؤرخ من الأدلة فقط. إذا لا يوجد خبر حديث قلها بصراحة.
- timing: high إذا الخبر خلال ٤٥ يومًا، medium خلال ٤ أشهر، low أقدم، none لا يوجد.
- fit: strong فقط إذا تطابق الدور والشركة وفيه توقيت high. وإلا medium أو possible.
- leadWith و avoid: نصيحة قصيرة لأول رسالة.
- opener: أول رسالة، سطرين إلى ثلاثة، بلهجة سعودية مهنية، تبدأ بـ«هلا» واسمه الأول.
- evidenceUrls: روابط من أدلة هذا المرشح فقط تدعم ما كتبته. لا تخترع روابط.

لا تذكر معلومة غير موجودة في الأدلة. استبعد من لا يناسب الهدف.`;

export async function claudeScore(
  apiKey: string, brief: Brief, rawText: string, candidates: Candidate[],
): Promise<ScoredItem[] | null> {
  const byId = new Map(candidates.map((c, i) => [`c${i + 1}`, c]));
  const payload = [...byId].map(([id, c]) => ({
    id,
    name: c.person.name,
    title: c.person.title,
    company: c.company.name,
    evidence: allowedEvidence(c).map((e) => ({ url: e.url, title: e.title, date: e.date || undefined })),
  }));

  const client = new Anthropic({ apiKey });
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(PickSchema) },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: `الهدف: ${rawText}\nالملخص: ${brief.summaryAr}\nنوع الهدف: ${brief.goalType}\n\nالمرشحون:\n${JSON.stringify(payload)}`,
    }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;

  const seen = new Set<string>();
  const items: ScoredItem[] = [];
  for (const p of response.parsed_output.picks) {
    const c = byId.get(p.candidateId);
    if (!c || seen.has(c.key)) continue;
    seen.add(c.key);
    const allowed = allowedEvidence(c);
    const cited = allowed.filter((e) => p.evidenceUrls.includes(e.url));
    // The profile always backs the "who"; cited signals back the "why now".
    const evidence = [...allowed.slice(0, c.person.profileUrl ? 1 : 0), ...cited]
      .filter((e, i, all) => all.findIndex((x) => x.url === e.url) === i);
    items.push({
      candidateKey: c.key,
      rank: items.length + 1,
      fit: capFit(p.fit, p.timing),
      thin: c.signals.length === 0,
      why: p.why,
      whyNow: p.whyNow,
      roleRelevance: p.fit === "possible" ? "متوسطة" : "عالية",
      companyRelevance: "عالية",
      timing: TIMING_LABEL[p.timing],
      leadWith: p.leadWith,
      avoid: p.avoid,
      opener: p.opener,
      channel: "linkedin",
      status: "proposed",
      evidence,
      generatedBy: "ai",
    });
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}

export async function score(
  input: { apiKey?: string; brief: Brief; rawText: string; plan: SearchPlan; candidates: Candidate[] },
): Promise<{ items: ScoredItem[]; scoredBy: "claude" | "rules" }> {
  if (input.candidates.length === 0) return { items: [], scoredBy: "rules" };
  if (input.apiKey) {
    try {
      const items = await claudeScore(input.apiKey, input.brief, input.rawText, input.candidates);
      if (items && items.length) return { items, scoredBy: "claude" };
    } catch {
      // Fall through: a failed model call must not lose the sourced people.
    }
  }
  return { items: rulesScore(input.brief, input.plan, input.candidates), scoredBy: "rules" };
}

/** One company, whether or not the provider gave its website (sector search often doesn't). */
function companyKey(c: { domain: string; name: string }): string {
  return c.domain || `name:${c.name.toLowerCase().replace(/\s+/g, " ").trim()}`;
}
