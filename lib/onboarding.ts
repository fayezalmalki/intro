import type { IconKey } from "@/components/site/ui";
import { SECTOR_OPTIONS, isMarket, type Market } from "./search/markets";
import type { UseCaseId } from "./site/types";

/**
 * Guided onboarding: read who someone is (LinkedIn or a company website),
 * ask three one-tap questions, and turn the answers into a first search that
 * runs the moment they finish. Pure data and functions — the page and the API
 * route import it, and it is tested on its own.
 */

/** What someone pasted: a LinkedIn profile, a website, or neither. */
export type Source = { kind: "linkedin"; url: string } | { kind: "website"; domain: string };

export function parseSource(input: string): Source | null {
  const v = input.trim();
  if (!v || v.length > 300) return null;
  const li = v.match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%.]{2,100})\/?(?:[?#].*)?$/i);
  if (li) return { kind: "linkedin", url: `https://www.linkedin.com/in/${li[1]}` };
  if (/linkedin\.com/i.test(v)) return null;
  const domain = v.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? { kind: "website", domain } : null;
}

export interface Goal { id: UseCaseId; icon: IconKey; en: string; ar: string; hint: { en: string; ar: string } }

/** Question 1: what are you after. Ids are the existing use cases. */
export const GOALS: Goal[] = [
  { id: "hire-me", icon: "briefcase", en: "A new job", ar: "وظيفة جديدة", hint: { en: "Reach the hiring manager, not the pile", ar: "اوصل لمسؤول التوظيف مباشرة" } },
  { id: "sell", icon: "trend", en: "Customers", ar: "عملاء", hint: { en: "Companies that need what you sell", ar: "شركات تحتاج اللي تبيعه" } },
  { id: "partner", icon: "handshake", en: "Partners", ar: "شركاء", hint: { en: "Distributors, alliances, integrations", ar: "موزعين وتحالفات وتكاملات" } },
  { id: "invest", icon: "sprout", en: "Investors", ar: "مستثمرين", hint: { en: "VCs and angels for your round", ar: "صناديق ومستثمرين لجولتك" } },
  { id: "hire", icon: "users", en: "People to hire", ar: "موظفين", hint: { en: "Senior talent for your team", ar: "كفاءات لفريقك" } },
  { id: "enter-market", icon: "flag", en: "Enter Saudi", ar: "دخول السوق السعودي", hint: { en: "Your first customers and partners here", ar: "أول عملاء وشركاء لك هنا" } },
];

/** Question 3: who to reach, per goal. `title` is what providers match on. */
export const WHO: Record<UseCaseId, { id: string; title: string; en: string; ar: string }[]> = {
  "hire-me": [
    { id: "manager", title: "Head", en: "The hiring manager", ar: "مسؤول التوظيف" },
    { id: "talent", title: "Talent Acquisition", en: "Recruiters", ar: "فريق التوظيف" },
    { id: "founder", title: "Founder", en: "Founders", ar: "المؤسسين" },
    { id: "exec", title: "Chief", en: "Executives", ar: "الإدارة التنفيذية" },
  ],
  sell: [
    { id: "exec", title: "Chief", en: "Decision makers", ar: "صاحب القرار" },
    { id: "procurement", title: "Procurement", en: "Procurement", ar: "المشتريات" },
    { id: "operations", title: "Operations", en: "Operations", ar: "العمليات" },
    { id: "it", title: "Technology", en: "IT & digital", ar: "التقنية والتحول الرقمي" },
  ],
  partner: [
    { id: "partnerships", title: "Partnerships", en: "Partnerships", ar: "الشراكات" },
    { id: "bd", title: "Business Development", en: "Business development", ar: "تطوير الأعمال" },
    { id: "founder", title: "Founder", en: "Founders", ar: "المؤسسين" },
  ],
  invest: [
    { id: "partner", title: "Partner", en: "VC partners", ar: "شركاء الصناديق" },
    { id: "principal", title: "Principal", en: "Principals", ar: "مديري الاستثمار" },
    { id: "founder", title: "Founder", en: "Angel founders", ar: "مؤسسين مستثمرين" },
  ],
  hire: [
    { id: "engineering", title: "Engineering", en: "Engineers", ar: "مهندسين" },
    { id: "product", title: "Product", en: "Product", ar: "منتج" },
    { id: "sales", title: "Sales", en: "Sales", ar: "مبيعات" },
    { id: "marketing", title: "Marketing", en: "Marketing", ar: "تسويق" },
  ],
  "enter-market": [
    { id: "exec", title: "Chief", en: "Decision makers", ar: "صاحب القرار" },
    { id: "partnerships", title: "Partnerships", en: "Partners & distributors", ar: "شركاء وموزعين" },
    { id: "procurement", title: "Procurement", en: "Procurement", ar: "المشتريات" },
  ],
};

/** Question 2: which sector (investors default to VC). */
export const SECTORS = SECTOR_OPTIONS;

export interface Answers { goal: UseCaseId; sector?: string; who?: string; market: Market }

const GOAL_IDS = new Set(GOALS.map((g) => g.id));
export const isGoal = (v: unknown): v is UseCaseId => typeof v === "string" && GOAL_IDS.has(v as UseCaseId);

/**
 * The first search for these answers: companies in the sector, with the role
 * to look for once one is opened — or, for hiring, the people themselves.
 */
export function firstSearch(a: Answers, lang: "ar" | "en"): string {
  const market = isMarket(a.market) ? a.market : "SA";
  const who = WHO[a.goal].find((w) => w.id === a.who) ?? WHO[a.goal][0];
  const sector = a.goal === "invest" ? a.sector || "Venture Capital & Private Equity" : a.sector;
  const q = new URLSearchParams({ lang, market });
  if (a.goal === "hire") {
    const sectorLabel = SECTORS.find((s) => s.id === sector)?.en;
    q.set("mode", "people");
    q.set("describe", `${who.title} leaders${sectorLabel ? ` in ${sectorLabel}` : ""}`);
  } else {
    q.set("mode", "companies");
    if (sector) q.set("sector", sector);
    q.set("role", who.title);
  }
  q.set("run", "1");
  return `/search?${q}`;
}

/**
 * A `next` worth keeping over the first search: something the visitor asked
 * for before signing up (a search with a query, or a request).
 */
export function isIntentfulNext(next: string): boolean {
  try {
    const u = new URL(next, "https://intro.sa");
    return (u.pathname === "/search" && Boolean(u.searchParams.get("q") || u.searchParams.get("preset")))
      || (u.pathname === "/new" && Boolean(u.searchParams.get("q")))
      || u.pathname.startsWith("/requests/") || u.pathname.startsWith("/leads/");
  } catch {
    return false;
  }
}
