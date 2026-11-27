import { DICTIONARY, starterById, type SectorRole } from "./search/dictionary";
import { toProviderTerms } from "./search/arabic";
import type { Brief, GoalType } from "./types";

/**
 * The structured intake (/new): the person picks a goal, sectors and who to
 * reach; a sentence is optional context. The brief is built from the picks,
 * so search never depends on guessing what free text meant.
 */

export const GOALS: { id: GoalType; en: string; ar: string; hintEn: string; hintAr: string; icon: string }[] = [
  { id: "sales", en: "Find customers", ar: "عملاء", hintEn: "Decision makers who'd buy what you sell", hintAr: "أصحاب القرار اللي يشترون اللي تبيعه", icon: "target" },
  { id: "job", en: "Find a job", ar: "وظيفة", hintEn: "Hiring managers and leaders where you want to work", hintAr: "مدراء التوظيف والقادة في الجهات اللي تبيها", icon: "briefcase" },
  { id: "partnership", en: "Find partners", ar: "شركاء", hintEn: "Partnerships and business development leads", hintAr: "مسؤولو الشراكات وتطوير الأعمال", icon: "handshake" },
  { id: "investment", en: "Find investors", ar: "مستثمرين", hintEn: "Partners at funds that invest in your sector", hintAr: "شركاء في صناديق تستثمر في قطاعك", icon: "sprout" },
];

/** Who to reach by default for each goal (provider title fragments). */
export const GOAL_ROLES: Record<GoalType, SectorRole[]> = {
  sales: [
    { title: "Chief Executive", en: "CEO / founder", ar: "الرئيس التنفيذي أو المؤسس" },
    { title: "Sales", en: "Head of sales", ar: "رئيس المبيعات" },
    { title: "Marketing", en: "Head of marketing", ar: "رئيس التسويق" },
  ],
  job: [
    { title: "Head", en: "Hiring manager (head of team)", ar: "مدير الفريق المعني" },
    { title: "Talent", en: "Talent / HR", ar: "الموارد البشرية والتوظيف" },
  ],
  partnership: [
    { title: "Partnerships", en: "Partnerships", ar: "الشراكات" },
    { title: "Business Development", en: "Business development", ar: "تطوير الأعمال" },
    { title: "Chief Executive", en: "CEO / founder", ar: "الرئيس التنفيذي أو المؤسس" },
  ],
  investment: [
    { title: "Partner", en: "Investment partner", ar: "شريك استثماري" },
    { title: "Investment", en: "Investment director", ar: "مدير الاستثمار" },
  ],
  person: [],
};

/** Role suggestions for a goal and its sectors, goal defaults first, no repeats. */
export function suggestedRoles(goal: GoalType, sectorIds: string[]): SectorRole[] {
  const all = [...GOAL_ROLES[goal], ...sectorIds.flatMap((id) => starterById(id)?.roles ?? [])];
  return all.filter((r, i) => all.findIndex((x) => x.title === r.title) === i);
}

export interface IntakePicks {
  goal: GoalType;
  /** Dictionary ids, or `custom:<text>` for a sector typed by the person. */
  sectors: string[];
  /** Role title fragments, or `custom:<text>`. */
  roles: string[];
  notes: string;
}

const label = (r: SectorRole, lang: "ar" | "en") => (lang === "ar" ? r.ar : r.en);
const custom = (v: string) => (v.startsWith("custom:") ? v.slice(7).trim() : null);

export function sectorLabel(id: string, lang: "ar" | "en"): string {
  const c = custom(id);
  if (c) return c;
  const s = starterById(id);
  return s ? (lang === "ar" ? s.ar : s.en) : id;
}

export function roleLabel(title: string, goal: GoalType, sectorIds: string[], lang: "ar" | "en"): string {
  const c = custom(title);
  if (c) return c;
  const r = suggestedRoles(goal, sectorIds).find((x) => x.title === title);
  return r ? label(r, lang) : title;
}

/** Builds the brief the search runs on, straight from the picks. */
export function briefFromPicks(p: IntakePicks): { brief: Brief; rawText: string; sectors: string[] } {
  const sectorIds = p.sectors.filter((s) => !custom(s));
  // A sector typed by hand still lands on a provider industry when we know it.
  const typed = p.sectors.map(custom).filter((s): s is string => Boolean(s));
  const mapped = typed.map((t) => toProviderTerms(t).industry).filter((x): x is string => Boolean(x));
  const industryIds = [...new Set([...sectorIds, ...mapped])];

  const roles = p.roles.length ? p.roles : GOAL_ROLES[p.goal].map((r) => r.title);
  const roleTitles = roles.map((r) => {
    const c = custom(r);
    if (!c) return r;
    // A typed role: its English words if any, else the provider terms for it.
    return /[a-z]/i.test(c) ? c : toProviderTerms(c).titles[0] ?? c;
  });

  const sectorsAr = p.sectors.map((s) => sectorLabel(s, "ar"));
  const rolesAr = roles.map((r) => roleLabel(r, p.goal, sectorIds, "ar"));
  const goalAr = GOALS.find((g) => g.id === p.goal)?.ar ?? "";
  const notes = p.notes.trim().slice(0, 600);
  const rawText = [`${goalAr}: ${rolesAr.join("، ")} في ${sectorsAr.join("، ")}`, notes].filter(Boolean).join(" — ");

  return {
    rawText,
    sectors: industryIds,
    brief: {
      goalType: p.goal,
      targetRoles: rolesAr,
      seniority: [],
      industries: sectorsAr,
      geos: ["السعودية"],
      inclusions: notes ? [notes] : [],
      exclusions: [],
      summaryAr: `بركز على ${rolesAr.join(" و")} في ${sectorsAr.join(" و")} بالسعودية.${notes ? ` ${notes}` : ""}`,
      confidence: industryIds.length ? 0.95 : 0.6,
      extractedBy: "form",
      industryIds,
      roleTitles,
    },
  };
}

/** Picks to prefill the form from an existing brief (editing) or a typed sentence. */
export function picksFromBrief(b: Brief | undefined, text: string): IntakePicks {
  const goal: GoalType = b && b.goalType !== "person" ? b.goalType : "sales";
  if (b?.industryIds?.length || b?.roleTitles?.length) {
    return { goal, sectors: b.industryIds ?? [], roles: b.roleTitles ?? [], notes: b.inclusions[0] ?? "" };
  }
  // A sentence: find dictionary sectors by name or synonym, keep the sentence as context.
  const t = ` ${text} `;
  const sectors = DICTIONARY.filter((d) => [d.ar, d.en, ...d.synonymsAr].some((w) => w && t.includes(w))).map((d) => d.id);
  const guessed = toProviderTerms(text).industry;
  if (guessed && !sectors.includes(guessed) && starterById(guessed)) sectors.push(guessed);
  return { goal, sectors: sectors.slice(0, 3), roles: [], notes: text.trim() };
}
