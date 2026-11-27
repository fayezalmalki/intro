import type { Brief, GoalType } from "../types";
import { toProviderTerms } from "../search/arabic";

/**
 * The brief is written in Arabic, for the requester to read and correct. The
 * people-data providers search in English. This is the bridge: a fixed table,
 * so what we search for is predictable and testable rather than re-guessed on
 * every request.
 */

interface Sector {
  /** Words that identify the sector in a brief's `industries` or raw text. */
  match: string[];
  /** The industry name providers file companies under (LinkedIn's taxonomy). */
  industry: string;
}

export const SECTORS: Sector[] = [
  { match: ["تأمين", "insurance"], industry: "Insurance" },
  { match: ["بنوك", "بنك", "مصرف", "bank"], industry: "Banking" },
  { match: ["تقنية مالية", "فنتك", "مدفوعات", "fintech", "payments"], industry: "Financial Services" },
  { match: ["صحة", "صحي", "مستشفى", "health"], industry: "Hospital & Health Care" },
  { match: ["تجزئة", "retail"], industry: "Retail" },
  { match: ["حكومي", "حكومة", "government"], industry: "Government Administration" },
  { match: ["عقار", "real estate"], industry: "Real Estate" },
  { match: ["لوجستيات", "شحن", "logistics"], industry: "Logistics and Supply Chain" },
  { match: ["اتصالات", "telecom"], industry: "Telecommunications" },
  { match: ["طاقة", "نفط", "energy", "oil"], industry: "Oil & Energy" },
  { match: ["تعليم", "education"], industry: "Education Management" },
  { match: ["استثمار", "مستثمر", "venture", "vc"], industry: "Venture Capital & Private Equity" },
  { match: ["تقنية", "برمجيات", "saas", "tech"], industry: "Information Technology & Services" },
];

interface Role {
  match: string[];
  /** A title fragment to search with; providers match it as a substring. */
  title: string;
}

export const ROLES: Role[] = [
  { match: ["منتج", "product"], title: "Product" },
  { match: ["تسويق", "marketing"], title: "Marketing" },
  { match: ["شراكات", "partnership"], title: "Partnerships" },
  { match: ["توظيف", "موارد بشرية", "talent", "recruit", "hr"], title: "Human Resources" },
  { match: ["open banking", "رقمي", "رقمية", "digital"], title: "Digital" },
  { match: ["تقني", "تقنية المعلومات", "technology", "cto"], title: "Technology" },
  { match: ["مبيعات", "sales"], title: "Sales" },
  { match: ["مشتريات", "procurement"], title: "Procurement" },
  { match: ["مالي", "cfo", "finance"], title: "Finance" },
  { match: ["عمليات", "operations"], title: "Operations" },
];

/**
 * Who to look for when the brief names no role: the person who decides, for
 * the kind of goal it is.
 */
const DEFAULT_TITLE: Record<GoalType, string> = {
  sales: "Chief",
  job: "Head",
  partnership: "Partnerships",
  investment: "Partner",
  person: "Chief",
};

export interface SearchPlan {
  industries: string[];
  titles: string[];
  /** Free text for a semantic company search when no sector is recognised. */
  fallbackQuery: string;
}

const has = (text: string, words: string[]) => {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w.toLowerCase()));
};

/**
 * Sectors named in a text, longest phrase first, each match consumed — so
 * "تقنية مالية" (fintech) does not also count as "تقنية" (tech).
 */
function sectorsIn(text: string): string[] {
  let rest = text.toLowerCase();
  const phrases = SECTORS
    .flatMap((s) => s.match.map((m) => ({ m: m.toLowerCase(), industry: s.industry })))
    .sort((a, b) => b.m.length - a.m.length);
  const found: string[] = [];
  for (const { m, industry } of phrases) {
    if (rest.includes(m)) {
      found.push(industry);
      rest = rest.split(m).join(" ");
    }
  }
  return found;
}

export function planSearch(brief: Brief, rawText: string, sectors: string[] = []): SearchPlan {
  // Industries from the brief first; the raw text only when the brief has none,
  // so a requester's correction on the confirm screen wins.
  const fromBrief = sectorsIn([...brief.industries, ...sectors].join(" | "));
  const translated = toProviderTerms([rawText, ...brief.industries].join(" "));
  const industries = fromBrief.length ? fromBrief : sectorsIn(rawText).length ? sectorsIn(rawText) : translated.industry ? [translated.industry] : [];

  const roleText = brief.targetRoles.join(" ");
  const titles = ROLES.filter((r) => has(roleText, r.match)).map((r) => r.title);

  return {
    industries: [...new Set(industries)].slice(0, 2),
    titles: titles.length ? [...new Set(titles)] : [DEFAULT_TITLE[brief.goalType]],
    // Providers index in English: the translated words, never the raw Arabic
    // sentence (which matched estate agents in Italy). Empty = nothing to search on.
    fallbackQuery: translated.terms.trim(),
  };
}

export type Seniority = "cxo" | "vp" | "head" | "director" | "partner" | "manager" | "other";

export function seniorityOf(title: string): Seniority {
  const t = title.toLowerCase();
  if (/\bchief\b|\bc[etfomhid]o\b|\bceo\b|founder|managing director|\bgm\b|general manager/.test(t)) return "cxo";
  if (/vice president|\bvp\b|\bsvp\b|\bevp\b/.test(t)) return "vp";
  if (/\bhead\b/.test(t)) return "head";
  if (/director/.test(t)) return "director";
  if (/partner/.test(t)) return "partner";
  if (/manager|lead\b/.test(t)) return "manager";
  return "other";
}

export const LEADERSHIP: Seniority[] = ["cxo", "vp", "head", "director", "partner"];

/** Does a provider's title fit one of the plan's title fragments? */
export function titleMatches(title: string, titles: string[]): boolean {
  const t = title.toLowerCase();
  return titles.some((x) => t.includes(x.toLowerCase()) || (x === "Chief" && seniorityOf(title) === "cxo"));
}
