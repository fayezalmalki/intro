import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Brief, GoalType } from "./types";

const BriefSchema = z.object({
  goalType: z.enum(["job", "sales", "partnership", "investment", "person"]),
  targetRoles: z.array(z.string()),
  seniority: z.array(z.string()),
  industries: z.array(z.string()),
  geos: z.array(z.string()),
  inclusions: z.array(z.string()),
  exclusions: z.array(z.string()),
  summaryAr: z.string(),
});

const SYSTEM = `أنت محلل طلبات في منصة Intro السعودية.
تستقبل طلبًا مكتوبًا بالعربي أو بالإنجليزي من شخص يريد الوصول إلى أشخاص معيّنين،
وتستخرج منه ملخصًا منظّمًا.

قواعد:
- goalType: job إذا كان يبحث عن وظيفة، sales إذا كان يبيع، partnership للشراكات،
  investment للمستثمرين، person إذا كان يقصد شخصًا محددًا بالاسم.
- targetRoles: المسميات الوظيفية المستهدفة، بالعربي.
- exclusions: ما يجب استثناؤه. استنتجه من الطلب فقط، لا تخترع استثناءات.
- summaryAr: جملة أو جملتان بصيغة المتكلم تبدأ بـ«بركز على…» تعيد صياغة الطلب
  كما يفهمه النظام، ليؤكدها صاحب الطلب أو يعدّلها.
- لا تضف معلومات غير موجودة في الطلب.`;

/**
 * Extracts a structured brief from the requester's free text.
 *
 * Uses Claude when credentials are available, and a deterministic keyword
 * extractor otherwise, so the app runs end to end with no API key configured.
 */
export async function extractBrief(rawText: string): Promise<Brief> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return rulesBrief(rawText);
  }
  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: rawText }],
      output_config: { format: zodOutputFormat(BriefSchema) },
    });
    const parsed = response.parsed_output;
    if (!parsed) return rulesBrief(rawText);
    return { ...parsed, confidence: 0.9, extractedBy: "claude" };
  } catch {
    // A failed extraction must not block intake — fall back and let the
    // requester correct the brief on the confirm screen.
    return rulesBrief(rawText);
  }
}

const GOAL_HINTS: Array<{ goal: GoalType; words: string[] }> = [
  { goal: "job", words: ["وظيفة", "دور", "أدور شغل", "توظيف", "job", "role", "hiring me"] },
  { goal: "sales", words: ["أبيع", "بيع", "عملاء", "sell", "clients", "customers"] },
  { goal: "partnership", words: ["شراكة", "شريك", "شراكات", "partner", "partnership"] },
  { goal: "investment", words: ["مستثمر", "تمويل", "استثمار", "investor", "funding", "raise"] },
];

const ROLE_HINTS: Array<{ role: string; words: string[] }> = [
  { role: "مدير منتج فأعلى", words: ["product", "المنتج", "منتج"] },
  { role: "رئيس التسويق", words: ["تسويق", "marketing", "cmo"] },
  { role: "رئيس الشراكات", words: ["شراكات", "partnerships"] },
  { role: "رئيس التوظيف التقني", words: ["توظيف", "talent", "recruit"] },
  { role: "مسؤول Open Banking", words: ["open banking", "بنوك", "بنك", "bank"] },
];

const INDUSTRY_HINTS: Array<{ industry: string; words: string[] }> = [
  { industry: "تقنية", words: ["تقنية", "تقني", "tech", "saas", "برمجيات"] },
  { industry: "تقنية مالية", words: ["تقنية مالية", "فنتك", "fintech", "مدفوعات", "payments"] },
  { industry: "بنوك", words: ["بنوك", "بنك", "bank"] },
  { industry: "تأمين", words: ["تأمين", "insurance"] },
  { industry: "لوجستيات", words: ["لوجستيات", "logistics", "شحن"] },
  { industry: "استثمار", words: ["استثمار", "مستثمر", "vc", "investor"] },
];

const SENIORITY_HINTS: Array<{ level: string; words: string[] }> = [
  { level: "قيادي", words: ["قيادي", "قيادية", "رئيس", "نائب", "leadership", "head", "vp", "chief"] },
  { level: "مدير", words: ["مدير", "مديرة", "director", "manager"] },
];

function hits(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

export function rulesBrief(rawText: string): Brief {
  const t = rawText.toLowerCase();

  const goalType =
    GOAL_HINTS.find((g) => hits(t, g.words))?.goal ?? ("person" as GoalType);
  const targetRoles = ROLE_HINTS.filter((r) => hits(t, r.words)).map((r) => r.role);
  const industries = INDUSTRY_HINTS.filter((i) => hits(t, i.words)).map((i) => i.industry);
  const seniority = SENIORITY_HINTS.filter((s) => hits(t, s.words)).map((s) => s.level);

  const geos: string[] = [];
  if (hits(t, ["سعودي", "السعودية", "الرياض", "جدة", "الخبر", "saudi", "riyadh"])) {
    geos.push("السعودية");
  }

  const exclusions: string[] = [];
  if (goalType === "job" && seniority.includes("قيادي")) {
    exclusions.push("أدوار غير قيادية");
  }

  const roleLabel = targetRoles[0] ?? "الأشخاص الأقرب لهدفك";
  const industryLabel = industries.length ? industries.join(" و") : "القطاع المستهدف";
  const geoLabel = geos.length ? ` في ${geos[0]}` : "";

  return {
    goalType,
    targetRoles,
    seniority,
    industries,
    geos,
    inclusions: [],
    exclusions,
    summaryAr: `بركز على ${roleLabel} والأشخاص الأقرب للقرار في ${industryLabel}${geoLabel}.`,
    confidence: targetRoles.length && industries.length ? 0.6 : 0.35,
    extractedBy: "rules",
  };
}
